'use client';

import React, { useState, useEffect } from 'react';
import { GameState } from '@/types/tournament';
import { Pause, Play, RotateCcw, Plus, Clock, Trophy, Users, Vote } from 'lucide-react';
import { advanceWinner, isRoundComplete, formatRoundName, getMaxRounds, findNextActiveMatch } from '@/utils/tournament';
import { supabase, startTimer, pauseTimer, resetTimer, updateTimerRemaining, logSupabaseOperation, createRobustSubscription, cleanupSubscription, getVoteTalliesForMatch } from '@/utils/supabase';
import ParticipantShape from '../ParticipantShape';

interface AnonymousActiveMatchProps {
  gameState: GameState;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'home' | 'setup' | 'bracket' | 'match') => void;
  tournamentCode: string;
  connectedVoters: number;
}

interface VoteTally {
  participantId: string;
  count: number;
}

const AnonymousActiveMatch: React.FC<AnonymousActiveMatchProps> = ({
  gameState,
  onUpdateGameState,
  onSetCurrentScreen,
  tournamentCode,
  connectedVoters
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showWinnerConfirm, setShowWinnerConfirm] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTournamentComplete, setShowTournamentComplete] = useState(false);
  const [tournamentChampion, setTournamentChampion] = useState<any>(null);
  const [voteTallies, setVoteTallies] = useState<VoteTally[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const { tournament } = gameState;
  const currentMatch = tournament?.currentMatch;

  useEffect(() => {
    if (tournament && currentMatch) {
      // Initialize timer from tournament state
      if (tournament.timerActive && tournament.timerRemaining !== undefined) {
        setTimeRemaining(tournament.timerRemaining);
        setIsTimerActive(tournament.timerActive);
      } else {
        setTimeRemaining(tournament.roundDuration);
        setIsTimerActive(false);
      }
      loadVoteTallies();
    }
  }, [tournament, currentMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTimerActive && timeRemaining > 0 && tournament?.id) {
      interval = setInterval(async () => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          
          // Update database every 5 seconds or when timer ends
          if (newTime % 5 === 0 || newTime <= 0) {
            updateTimerRemaining(tournament.id, newTime);
          }
          
          if (newTime <= 0) {
            setIsTimerActive(false);
            // Also update database to stop timer
            pauseTimer(tournament.id);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isTimerActive, timeRemaining, tournament?.id]);

  // Load and subscribe to vote tallies with enhanced real-time
  useEffect(() => {
    if (!currentMatch || !tournament?.id) return;

    logSupabaseOperation('Vote Subscription Setup', { matchId: currentMatch.id, tournamentId: tournament.id });

    // Load initial vote tallies
    loadVoteTallies();

    // Set up periodic refresh as primary method (more reliable than real-time)
    const refreshInterval = setInterval(() => {
      logSupabaseOperation('Periodic Vote Refresh', { matchId: currentMatch.id });
      loadVoteTallies();
    }, 2000); // Every 2 seconds for better responsiveness

    // Subscribe to real-time vote updates using robust subscription
    const channel = createRobustSubscription(
      `match-votes-${currentMatch.id}-${Date.now()}`,
      'votes',
      `tournament_id=eq.${tournament.id}`,
      (payload) => {
        const newRecord = payload.new as any;
        const oldRecord = payload.old as any;
        
        // Process immediately if it's for our match
        if (newRecord?.match_id === currentMatch.id || oldRecord?.match_id === currentMatch.id) {
          logSupabaseOperation('Vote Change for Current Match', {
            matchId: currentMatch.id,
            event: payload.eventType,
            participantId: newRecord?.participant_id || oldRecord?.participant_id
          });
          // Immediate update
          loadVoteTallies();
        }
      },
      (status) => {
        logSupabaseOperation('Vote Subscription Status', { 
          status, 
          matchId: currentMatch.id,
          tournamentId: tournament.id
        });
      }
    );

    return () => {
      logSupabaseOperation('Vote Subscription Cleanup', { matchId: currentMatch.id });
      clearInterval(refreshInterval);
      cleanupSubscription(channel, `match-votes-${currentMatch.id}`);
    };
  }, [currentMatch?.id, tournament?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadVoteTallies = async () => {
    if (!currentMatch || !tournament?.id) return;

    try {
      const { tallies, totalVotes } = await getVoteTalliesForMatch(tournament.id, currentMatch.id);
      setVoteTallies(tallies);
      setTotalVotes(totalVotes);
    } catch (err) {
      logSupabaseOperation('Load Vote Tallies Error', { tournamentId: tournament.id, matchId: currentMatch.id }, err);
    }
  };

  // Auto-advance matches with only one participant (same as Local Mode)
  useEffect(() => {
    if (!currentMatch || !tournament) return;
    
    const participantCount = [currentMatch.participant1, currentMatch.participant2].filter(Boolean).length;
    const maxRounds = getMaxRounds(tournament.participants.length);
    const isChampionshipMatch = currentMatch.round === maxRounds;
    
    if (participantCount === 0) {
      onSetCurrentScreen('bracket');
      return;
    } else if (participantCount === 1 && !isChampionshipMatch) {
      const winner = currentMatch.participant1 || currentMatch.participant2;
      if (winner) {
        const autoAdvanceTimer = setTimeout(() => {
          const updatedMatches = tournament.matches.map(match => 
            match.id === currentMatch.id 
              ? { ...match, winner, status: 'completed' as const }
              : match
          );

          const finalMatches = advanceWinner(updatedMatches, { ...currentMatch, winner });
          
          onUpdateGameState(prev => ({
            ...prev,
            tournament: prev.tournament ? {
              ...prev.tournament,
              matches: finalMatches,
              currentMatch: null,
              status: 'active'
            } : null
          }));
          
          onSetCurrentScreen('bracket');
        }, 1000);

        return () => clearTimeout(autoAdvanceTimer);
      }
    }
  }, [currentMatch, tournament, onUpdateGameState, onSetCurrentScreen]);

  const handleStartTimer = async () => {
    if (!tournament?.id) return;
    
    const success = await startTimer(tournament.id, timeRemaining);
    if (success) {
      setIsTimerActive(true);
    }
  };

  const handlePauseTimer = async () => {
    if (!tournament?.id) return;
    
    const success = await pauseTimer(tournament.id);
    if (success) {
      setIsTimerActive(false);
    }
  };

  const handleResetTimer = async () => {
    if (!tournament?.id) return;
    
    const success = await resetTimer(tournament.id, tournament.roundDuration);
    if (success) {
      setIsTimerActive(false);
      setTimeRemaining(tournament.roundDuration);
    }
  };

  const handleAddTime = async (seconds: number) => {
    if (!tournament?.id) return;
    
    const newTime = timeRemaining + seconds;
    setTimeRemaining(newTime);
    
    // Update database
    await updateTimerRemaining(tournament.id, newTime);
  };

  const handleEndMatch = async () => {
    if (!tournament?.id || !currentMatch || isAdvancing) return;
    
    setIsAdvancing(true);
    
    try {
      // Stop the timer
      const success = await pauseTimer(tournament.id);
      if (success) {
        setIsTimerActive(false);
      }
      
      // Determine winner based on current vote tallies
      let winner = null;
      
      if (currentMatch.participant1 && currentMatch.participant2) {
        const votes1 = voteTallies.find(t => t.participantId === currentMatch.participant1!.id)?.count || 0;
        const votes2 = voteTallies.find(t => t.participantId === currentMatch.participant2!.id)?.count || 0;
        
        if (votes1 > votes2) {
          winner = currentMatch.participant1;
        } else if (votes2 > votes1) {
          winner = currentMatch.participant2;
        } else {
          // Tie - pick randomly
          winner = Math.random() < 0.5 ? currentMatch.participant1 : currentMatch.participant2;
        }
      } else if (currentMatch.participant1) {
        // Bye match
        winner = currentMatch.participant1;
      }

      if (!winner) {
        logSupabaseOperation('End Match - No Winner', { currentMatch });
        setIsAdvancing(false);
        return;
      }

      logSupabaseOperation('End Match - Winner Determined', {
        winner: winner.name,
        winnerId: winner.id,
        votes1: currentMatch.participant1 ? voteTallies.find(t => t.participantId === currentMatch.participant1!.id)?.count || 0 : 0,
        votes2: currentMatch.participant2 ? voteTallies.find(t => t.participantId === currentMatch.participant2!.id)?.count || 0 : 0
      });

      // Update match with winner
      const updatedMatches = tournament.matches.map(match => 
        match.id === currentMatch.id 
          ? { ...match, winner, status: 'completed' as const }
          : match
      );

      // Advance winner to next round
      const finalMatches = advanceWinner(updatedMatches, { ...currentMatch, winner });
      
      // Check if tournament is complete
      const maxRounds = getMaxRounds(tournament.participants.length);
      const isLastMatch = currentMatch.round === maxRounds;
      
      let newStatus: 'active' | 'completed' = 'active';
      
      if (isLastMatch) {
        // Tournament is complete
        setTournamentChampion(winner);
        setShowTournamentComplete(true);
        newStatus = 'completed';
      }

      // Update local state - keep current match for celebration, but mark as completed
      onUpdateGameState(prev => ({
        ...prev,
        tournament: prev.tournament ? {
          ...prev.tournament,
          matches: finalMatches,
          currentMatch: { ...currentMatch, winner, status: 'completed' as const }, // Keep match for celebration
          status: newStatus
        } : null
      }));

      // Update database
      await supabase
        .from('tournaments')
        .update({
          matches: finalMatches,
          current_match_id: null, // Clear active match in database
          status: newStatus,
          updated_at: new Date().toISOString(),
          host_last_seen: new Date().toISOString(),
          timer_active: false,
          timer_remaining: 0,
          timer_started_at: null
        })
        .eq('id', tournament.id);

      if (isLastMatch) {
        // Show tournament completion celebration
        // Component will show the celebration screen
      } else {
        // Show winner celebration, then return to bracket
        setSelectedWinner(winner.id);
        setShowCelebration(true);
        setTimeout(() => {
          setShowCelebration(false);
          setSelectedWinner(null);
          // Now clear the current match and go to bracket
          onUpdateGameState(prev => ({
            ...prev,
            tournament: prev.tournament ? {
              ...prev.tournament,
              currentMatch: null
            } : null
          }));
          onSetCurrentScreen('bracket');
        }, 3000);
      }

    } catch (err) {
      console.error('Error ending match:', err);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleSelectWinner = (participantId: string) => {
    setSelectedWinner(participantId);
    setShowWinnerConfirm(true);
  };

  const handleRandomWinner = () => {
    const participants = [currentMatch?.participant1, currentMatch?.participant2].filter(Boolean);
    if (participants.length === 0) return;
    
    const randomWinner = participants[Math.floor(Math.random() * participants.length)];
    if (randomWinner) {
      setSelectedWinner(randomWinner.id);
      setShowWinnerConfirm(true);
    }
  };

  const handleConfirmWinner = async () => {
    if (!selectedWinner || !currentMatch || !tournament || isAdvancing) return;

    setIsAdvancing(true);
    
    try {
      const winner = currentMatch.participant1?.id === selectedWinner 
        ? currentMatch.participant1 
        : currentMatch.participant2;

      if (!winner) {
        setIsAdvancing(false);
        return;
      }

      logSupabaseOperation('Manual Winner Selection', {
        currentMatchId: currentMatch.id,
        winner: winner.name,
        winnerId: winner.id
      });

      // Update match with winner
      const updatedMatches = tournament.matches.map(match => 
        match.id === currentMatch.id 
          ? { ...match, winner, status: 'completed' as const }
          : match
      );

      // Advance winner to next round
      const finalMatches = advanceWinner(updatedMatches, { ...currentMatch, winner });
      
      // Check if tournament is complete
      const maxRounds = getMaxRounds(tournament.participants.length);
      const isLastMatch = currentMatch.round === maxRounds;
      
      let nextActiveMatch = null;
      let newStatus: 'active' | 'completed' = 'active';
      
      if (isLastMatch) {
        // Tournament is complete
        setTournamentChampion(winner);
        setShowTournamentComplete(true);
        newStatus = 'completed';
      } else {
        // Find the next match that should become active
        nextActiveMatch = findNextActiveMatch(finalMatches);
        
        if (nextActiveMatch) {
          // Mark the next match as active
          const matchesWithNextActive = finalMatches.map(match => 
            match.id === nextActiveMatch!.id 
              ? { ...match, status: 'active' as const }
              : match
          );
          
          finalMatches.splice(0, finalMatches.length, ...matchesWithNextActive);
        } else {
          newStatus = 'completed';
        }
      }

      // Update local state
      onUpdateGameState(prev => ({
        ...prev,
        tournament: prev.tournament ? {
          ...prev.tournament,
          matches: finalMatches,
          currentMatch: isLastMatch ? currentMatch : null, // Keep current match for championship celebration
          status: newStatus
        } : null
      }));

      // Update database
      await supabase
        .from('tournaments')
        .update({
          matches: finalMatches,
          current_match_id: nextActiveMatch?.id || null,
          status: newStatus,
          updated_at: new Date().toISOString(),
          host_last_seen: new Date().toISOString(),
          ...(nextActiveMatch ? {
            timer_active: false, // Don't auto-start next match timer
            timer_remaining: tournament.roundDuration || 120,
            timer_started_at: null
          } : {
            timer_active: false,
            timer_remaining: 0,
            timer_started_at: null
          })
        })
        .eq('id', tournament.id);

      setShowWinnerConfirm(false);
      setSelectedWinner(null);

      if (isLastMatch) {
        // Show tournament completion celebration
        // Component will show the celebration screen
      } else {
        // Show winner celebration, then return to bracket
        setShowCelebration(true);
        setTimeout(() => {
          setShowCelebration(false);
          onSetCurrentScreen('bracket');
        }, 3000);
      }

    } catch (err) {
      console.error('Error confirming winner:', err);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleAdvanceMatch = async () => {
    if (!currentMatch || !tournament || isAdvancing) return;

    setIsAdvancing(true);
    
    try {
      logSupabaseOperation('Advance Match - Start', {
        currentMatchId: currentMatch.id,
        currentRound: currentMatch.round,
        participant1: currentMatch.participant1?.name,
        participant2: currentMatch.participant2?.name,
        voteTallies: voteTallies,
        totalVotes: totalVotes
      });
      
      // Determine winner based on vote tallies
      let winner = null;
      
      if (currentMatch.participant1 && currentMatch.participant2) {
        const votes1 = voteTallies.find(t => t.participantId === currentMatch.participant1!.id)?.count || 0;
        const votes2 = voteTallies.find(t => t.participantId === currentMatch.participant2!.id)?.count || 0;
        
        if (votes1 > votes2) {
          winner = currentMatch.participant1;
        } else if (votes2 > votes1) {
          winner = currentMatch.participant2;
        } else {
          // Tie - pick randomly
          winner = Math.random() < 0.5 ? currentMatch.participant1 : currentMatch.participant2;
        }
      } else if (currentMatch.participant1) {
        // Bye match
        winner = currentMatch.participant1;
      }

      if (!winner) {
        logSupabaseOperation('Advance Match - No Winner', { currentMatch });
        setIsAdvancing(false);
        return;
      }

      logSupabaseOperation('Advance Match - Winner Determined', {
        winner: winner.name,
        winnerId: winner.id,
        votes1: currentMatch.participant1 ? voteTallies.find(t => t.participantId === currentMatch.participant1!.id)?.count || 0 : 0,
        votes2: currentMatch.participant2 ? voteTallies.find(t => t.participantId === currentMatch.participant2!.id)?.count || 0 : 0
      });

      setSelectedWinner(winner.id);
      setShowWinnerConfirm(true);
      
      // Update match with winner
      const updatedMatches = tournament.matches.map(match => 
        match.id === currentMatch.id 
          ? { ...match, winner, status: 'completed' as const }
          : match
      );

      // Advance winner to next round
      const finalMatches = advanceWinner(updatedMatches, { ...currentMatch, winner });
      
      // Check if tournament is complete
      const maxRounds = getMaxRounds(tournament.participants.length);
      const isLastMatch = currentMatch.round === maxRounds;
      
      let nextActiveMatch = null;
      let newStatus: 'active' | 'completed' = 'active';
      
      if (isLastMatch) {
        // Tournament is complete
        setTournamentChampion(winner);
        setShowTournamentComplete(true);
        newStatus = 'completed';
      } else {
        // Find the next match that should become active
        nextActiveMatch = findNextActiveMatch(finalMatches);
        
        logSupabaseOperation('Finding Next Active Match', {
          nextActiveMatch: nextActiveMatch ? {
            id: nextActiveMatch.id,
            round: nextActiveMatch.round,
            participant1: nextActiveMatch.participant1?.name,
            participant2: nextActiveMatch.participant2?.name,
            status: nextActiveMatch.status
          } : null,
          totalPendingMatches: finalMatches.filter(m => m.status === 'pending').length
        });
        
        if (nextActiveMatch) {
          // Mark the next match as active
          const matchesWithNextActive = finalMatches.map(match => 
            match.id === nextActiveMatch!.id 
              ? { ...match, status: 'active' as const }
              : match
          );
          
          // Update finalMatches to include the newly active match
          finalMatches.splice(0, finalMatches.length, ...matchesWithNextActive);
        } else {
          // No more matches available - tournament complete
          newStatus = 'completed';
          logSupabaseOperation('Tournament Complete', { reason: 'No more matches available' });
        }
      }

      // Update local state
      onUpdateGameState(prev => ({
        ...prev,
        tournament: prev.tournament ? {
          ...prev.tournament,
          matches: finalMatches,
          currentMatch: nextActiveMatch,
          status: newStatus
        } : null
      }));

      // Update database
      await supabase
        .from('tournaments')
        .update({
          matches: finalMatches,
          current_match_id: nextActiveMatch?.id || null,
          status: newStatus,
          updated_at: new Date().toISOString(),
          host_last_seen: new Date().toISOString(),
          // Start timer for the next match if there is one
          ...(nextActiveMatch ? {
            timer_active: true,
            timer_remaining: tournament.roundDuration || 120,
            timer_started_at: new Date().toISOString(),
            timer_duration: tournament.roundDuration || 120
          } : {
            timer_active: false,
            timer_remaining: 0,
            timer_started_at: null
          })
        })
        .eq('id', tournament.id);

      // Show celebration before continuing
      setShowCelebration(true);
      setTimeout(() => {
        setShowCelebration(false);
        setShowWinnerConfirm(false);
        
        if (nextActiveMatch) {
          // Continue to next match - stay on match screen
          // The component will automatically update due to real-time subscription
        } else {
          // Tournament complete - return to bracket view
          onSetCurrentScreen('bracket');
        }
      }, 3000);

    } catch (err) {
      console.error('Error advancing match:', err);
    } finally {
      setIsAdvancing(false);
    }
  };

  const getVoteCount = (participantId: string): number => {
    return voteTallies.find(t => t.participantId === participantId)?.count || 0;
  };

  const getVotePercentage = (participantId: string): number => {
    if (totalVotes === 0) return 0;
    return (getVoteCount(participantId) / totalVotes) * 100;
  };

  if (!tournament || !currentMatch) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No Active Match</h2>
          <button
            onClick={() => onSetCurrentScreen('bracket')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            Back to Bracket
          </button>
        </div>
      </div>
    );
  }

  // Tournament Complete Screen - Match Local Mode Celebration
  if (showTournamentComplete && tournamentChampion) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="relative overflow-hidden bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          {/* Falling animations */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 50 }, (_, i) => (
              <div
                key={i}
                className="absolute text-4xl animate-bounce opacity-80"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${-10 + Math.random() * 120}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              >
                {['🎉', '🎊', '🏆', '👑', '⭐', '💫', '🎈', '🎁', '🌟', '✨'][Math.floor(Math.random() * 10)]}
              </div>
            ))}
            
            {/* Floating balloons */}
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={`balloon-${i}`}
                className="absolute text-6xl animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 4}s`,
                  animationDuration: `${3 + Math.random() * 2}s`,
                }}
              >
                🎈
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="relative z-10 p-8 text-center text-white">
            <div className="text-8xl mb-8 animate-pulse">🏆</div>
            <h1 className="text-7xl font-black mb-6 text-yellow-100 drop-shadow-2xl animate-bounce">
              CHAMPION!
            </h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-8 mb-8 border-4 border-yellow-300">
              <div className="flex items-center justify-center gap-6 mb-4">
                <ParticipantShape visualId={tournamentChampion.visualId} size="xl" className="transform scale-150" />
                <div>
                  <h2 className="text-5xl font-bold text-yellow-100 mb-2">{tournamentChampion.name}</h2>
                  <p className="text-2xl text-yellow-200">Tournament Winner!</p>
                </div>
              </div>
            </div>
            
            <div className="text-3xl font-bold mb-8 text-yellow-100 animate-pulse">
              🎊 TOURNAMENT COMPLETE! 🎊
            </div>
            
            <div className="flex justify-center gap-8 mb-8">
              {['🎉', '🏆', '👑', '⭐', '💫'].map((emoji, i) => (
                <div
                  key={i}
                  className="text-6xl animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  {emoji}
                </div>
              ))}
            </div>
            
            <p className="text-xl text-yellow-100 mb-8">
              Congratulations to {tournamentChampion.name} for winning {tournament.name}!
            </p>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setShowTournamentComplete(false);
                  setTournamentChampion(null);
                  onSetCurrentScreen('bracket');
                }}
                className="bg-white/20 hover:bg-white/30 text-white font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border-2 border-white/40"
              >
                Close Celebration
              </button>
              <button
                onClick={() => {
                  setShowTournamentComplete(false);
                  setTournamentChampion(null);
                  onSetCurrentScreen('bracket');
                }}
                className="bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-105"
              >
                View Final Bracket
              </button>
              <button
                onClick={() => {
                  setShowTournamentComplete(false);
                  setTournamentChampion(null);
                  onSetCurrentScreen('home');
                }}
                className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-105"
              >
                New Tournament
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Winner Celebration Screen - Match Local Mode
  if (showCelebration && selectedWinner) {
    const winner = [currentMatch.participant1, currentMatch.participant2].find(p => p?.id === selectedWinner);
    const maxRounds = getMaxRounds(tournament.participants.length);
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-blue-500">
        <div className="text-center text-white max-w-2xl">
          <div className="text-6xl mb-4 animate-bounce">🎉</div>
          <h1 className="text-4xl font-bold mb-4">Congratulations!</h1>
          {winner && (
            <div className="flex items-center justify-center gap-4 mb-4">
              <ParticipantShape visualId={winner.visualId} size="xl" />
              <span className="text-3xl font-bold">{winner.name}</span>
            </div>
          )}
          <p className="text-xl mb-8">
            {winner?.name} has advanced to {formatRoundName(currentMatch.round + 1, maxRounds)}!
          </p>
          <div className="flex gap-4 justify-center mb-8">
            <div className="text-4xl animate-bounce">🎊</div>
            <div className="text-4xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎈</div>
            <div className="text-4xl animate-bounce" style={{ animationDelay: '0.4s' }}>🎉</div>
          </div>
          <button
            onClick={() => {
              setShowCelebration(false);
              onSetCurrentScreen('bracket');
            }}
            className="bg-white/20 hover:bg-white/30 text-white font-bold py-4 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border-2 border-white/40"
          >
            Continue to Bracket
          </button>
        </div>
      </div>
    );
  }

  const maxRounds = getMaxRounds(tournament.participants.length);
  const roundName = formatRoundName(currentMatch.round, maxRounds);
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-100 to-pink-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">{tournament.name}</h1>
            <div className="flex items-center gap-2 text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
              <Users size={16} />
              Code: <span className="font-bold">{tournamentCode}</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
              <Users size={16} />
              {connectedVoters} voters connected
            </div>
            <div className="flex items-center gap-2 text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
              <Vote size={16} />
              {totalVotes} votes cast
            </div>
          </div>
        </div>
      </div>

      {/* Match Info */}
      <div className="bg-white border-b px-6 py-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            {roundName} - Match {currentMatch.position + 1}
          </h2>
          
          {/* Timer */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className={`text-4xl font-mono font-bold ${
              timeRemaining <= 30 ? 'text-red-500' : 'text-gray-700'
            }`}>
              {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </div>
            
            {/* Host Controls - Match Local Mode */}
            <div className="flex gap-2">
              {!isTimerActive ? (
                <button
                  onClick={handleStartTimer}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg"
                  title="Start Timer"
                >
                  <Play size={18} />
                  Start
                </button>
              ) : (
                <button
                  onClick={handlePauseTimer}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg"
                  title="Pause Timer"
                >
                  <Pause size={18} />
                  Pause
                </button>
              )}
              
              <button
                onClick={() => handleAddTime(30)}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg"
                title="Add 30 seconds"
              >
                <Plus size={18} />
                +30s
              </button>

              <button
                onClick={() => handleAddTime(60)}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg"
                title="Add 1 minute"
              >
                <Plus size={18} />
                +1min
              </button>
              
              <button
                onClick={handleResetTimer}
                className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg"
                title="Reset Timer"
              >
                <RotateCcw size={18} />
                Reset
              </button>

              <button
                onClick={handleRandomWinner}
                className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg"
                title="Select Random Winner"
              >
                <Trophy size={18} />
                Random
              </button>

              <button
                onClick={handleEndMatch}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg"
                title="End Match & Declare Winner by Votes"
              >
                <Clock size={18} />
                End Match
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Match Display */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          {currentMatch.participant2 ? (
            <div className="grid grid-cols-3 gap-8 items-center">
              {/* Participant 1 - Clickable to select winner */}
              <div className="text-center">
                <button
                  onClick={() => handleSelectWinner(currentMatch.participant1!.id)}
                  className="w-full bg-white hover:bg-gray-50 border-4 border-gray-200 hover:border-blue-400 rounded-2xl shadow-xl p-8 mb-4 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl group"
                >
                  <ParticipantShape visualId={currentMatch.participant1!.visualId} size="xl" className="mx-auto mb-4 transform group-hover:scale-110 transition-transform duration-300" />
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">{currentMatch.participant1!.name}</h3>
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {getVoteCount(currentMatch.participant1!.id)}
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    {getVotePercentage(currentMatch.participant1!.id).toFixed(1)}% of votes
                  </div>
                  <div className="text-blue-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 mb-3">
                    Click to select winner!
                  </div>
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-500"
                      style={{ width: `${getVotePercentage(currentMatch.participant1!.id)}%` }}
                    />
                  </div>
                  
                  {/* Debug info in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded mt-2">
                      <div>Participant ID: {currentMatch.participant1!.id}</div>
                      <div>Vote Tallies: {JSON.stringify(voteTallies)}</div>
                      <div>Total Votes: {totalVotes}</div>
                    </div>
                  )}
                </button>
              </div>

              {/* VS - Simplified center area */}
              <div className="text-center">
                <div className="text-4xl font-black text-gray-500 mb-4">VS</div>
                <div className="text-lg text-gray-600 mb-6">
                  {isTimerActive && timeRemaining > 0 
                    ? '⏰ VOTING NOW!' 
                    : timeRemaining === 0 
                    ? '⏱️ TIME UP!'
                    : '⏸️ PAUSED'
                  }
                </div>
                <div className="space-y-3">
                  {/* Large Back to Bracket Button */}
                  <button
                    onClick={() => onSetCurrentScreen('bracket')}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-3 rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    Back to Bracket
                  </button>
                  
                  <button
                    onClick={handleAdvanceMatch}
                    disabled={isAdvancing}
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAdvancing ? 'Processing...' : 'Start Next Match'}
                  </button>
                  
                  <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                    Or click on a participant above to manually select winner
                  </div>
                  
                  {/* Debug refresh button in development */}
                  {process.env.NODE_ENV === 'development' && (
                    <button
                      onClick={loadVoteTallies}
                      className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
                    >
                      🔄 Refresh Votes
                    </button>
                  )}
                </div>
              </div>

              {/* Participant 2 - Clickable to select winner */}
              <div className="text-center">
                <button
                  onClick={() => handleSelectWinner(currentMatch.participant2!.id)}
                  className="w-full bg-white hover:bg-gray-50 border-4 border-gray-200 hover:border-red-400 rounded-2xl shadow-xl p-8 mb-4 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl group"
                >
                  <ParticipantShape visualId={currentMatch.participant2!.visualId} size="xl" className="mx-auto mb-4 transform group-hover:scale-110 transition-transform duration-300" />
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">{currentMatch.participant2!.name}</h3>
                  <div className="text-3xl font-bold text-red-600 mb-2">
                    {getVoteCount(currentMatch.participant2!.id)}
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    {getVotePercentage(currentMatch.participant2!.id).toFixed(1)}% of votes
                  </div>
                  <div className="text-red-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 mb-3">
                    Click to select winner!
                  </div>
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-red-500 h-full transition-all duration-500"
                      style={{ width: `${getVotePercentage(currentMatch.participant2!.id)}%` }}
                    />
                  </div>
                </button>
              </div>
            </div>
          ) : (
            // Bye match - single participant
            <div className="text-center">
              <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md mx-auto">
                <ParticipantShape visualId={currentMatch.participant1!.visualId} size="xl" className="mx-auto mb-6" />
                <h3 className="text-3xl font-bold text-gray-800 mb-4">{currentMatch.participant1!.name}</h3>
                <div className="text-lg text-gray-600 mb-6">
                  Bye - Advances Automatically
                </div>
                <button
                  onClick={handleAdvanceMatch}
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-bold text-lg"
                >
                  Advance to Next Round
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Round Matches Footer - Only show on larger screens */}
      <div className="hidden lg:block bg-white border-t shadow-lg px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">
            {formatRoundName(currentMatch.round, getMaxRounds(tournament.participants.length))} - All Matches
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            {tournament.matches
              .filter(m => m.round === currentMatch.round)
              .map((match, index) => {
                const isCurrent = match.id === currentMatch.id;
                const isCompleted = match.status === 'completed';
                
                return (
                  <div
                    key={match.id}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                      isCurrent 
                        ? 'bg-purple-100 border-purple-300 text-purple-800' 
                        : isCompleted
                        ? 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-gray-100 border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCurrent && <span className="text-purple-600">▶️</span>}
                      {isCompleted && <span className="text-green-600">✅</span>}
                      {!isCurrent && !isCompleted && <span className="text-gray-400">⏸️</span>}
                      
                      <span>
                        {match.participant1?.name || 'TBD'} vs {match.participant2?.name || 'TBD'}
                      </span>
                      
                      {isCompleted && match.winner && (
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded ml-2">
                          Winner: {match.winner.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Winner Confirmation Modal */}
      {showWinnerConfirm && selectedWinner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-black">Confirm Winner</h3>
            <p className="mb-4 text-black">
              Are you sure you want to declare{' '}
              <strong className="text-black">
                {currentMatch.participant1?.id === selectedWinner 
                  ? currentMatch.participant1.name 
                  : currentMatch.participant2?.name}
              </strong>{' '}
              as the winner?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowWinnerConfirm(false);
                  setSelectedWinner(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWinner}
                disabled={isAdvancing}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50"
              >
                {isAdvancing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnonymousActiveMatch;
