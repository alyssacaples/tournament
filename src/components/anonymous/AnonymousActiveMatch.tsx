'use client';

import React, { useState, useEffect } from 'react';
import { GameState } from '@/types/tournament';
import { Pause, Play, RotateCcw, Plus, Clock, Trophy, Users, Home } from 'lucide-react';
import { advanceWinner, isRoundComplete, formatRoundName, getMaxRounds } from '@/utils/tournament';
import { startMatchWithTimer, checkAllVotersVoted, accelerateTimer, endMatchWithWinner, getVoteTalliesForMatch, supabase, updateTimerRemaining } from '@/utils/supabase';
import ParticipantShape from '../ParticipantShape';

interface AnonymousActiveMatchProps {
  gameState: GameState;
  tournament: GameState['tournament'];
  tournamentCode: string;
  connectedVoters: number;
  onUpdateGameState: (updater: (prev: GameState) => GameState) => void;
  onSetCurrentScreen: (screen: 'home' | 'setup' | 'bracket' | 'match') => void;
}

const AnonymousActiveMatch: React.FC<AnonymousActiveMatchProps> = ({
  gameState,
  tournamentCode,
  connectedVoters,
  onUpdateGameState,
  onSetCurrentScreen
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showWinnerConfirm, setShowWinnerConfirm] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTournamentComplete, setShowTournamentComplete] = useState(false);
  const [tournamentChampion, setTournamentChampion] = useState<any>(null);
  const [voteCheckInterval, setVoteCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [hasAccelerated, setHasAccelerated] = useState(false);
  const [liveTallies, setLiveTallies] = useState<{[key: string]: number}>({});
  const [totalVotes, setTotalVotes] = useState(0);

  const { tournament } = gameState;
  const currentMatch = tournament?.currentMatch;

  useEffect(() => {
    if (tournament && currentMatch) {
      setTimeRemaining(tournament.roundDuration);
      // Reset vote tallies for new match
      setLiveTallies({});
      setTotalVotes(0);
      setHasAccelerated(false);
    }
  }, [tournament, currentMatch]);

  // Check database for current timer state when component loads
  useEffect(() => {
    if (!tournamentCode) return;
    
    const checkTimerState = async () => {
      try {
        if (!supabase) return;
        
        const { data, error } = await supabase
          .from('tournaments')
          .select('timer_active, timer_remaining, timer_started_at')
          .eq('code', tournamentCode)
          .single();
          
        if (error) throw error;
        
        if (data && data.timer_active && data.timer_remaining > 0) {
          console.log('Found active timer in database:', data.timer_remaining);
          setTimeRemaining(data.timer_remaining);
          setIsTimerActive(true);
        }
      } catch (error) {
        console.error('Error checking timer state:', error);
      }
    };
    
    checkTimerState();    }, [tournamentCode]);

  // Subscribe to real-time timer updates
  useEffect(() => {
    if (!tournamentCode || !supabase) return;

    const channel = supabase
      .channel(`timer-${tournamentCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `code=eq.${tournamentCode}`
        },
        (payload) => {
          console.log('Timer update received:', payload.new);
          
          const newTimerActive = payload.new.timer_active;
          const newTimerRemaining = payload.new.timer_remaining || 0;
          
          // Always update the timer remaining from database
          setTimeRemaining(newTimerRemaining);
          
          if (newTimerActive && newTimerRemaining > 0) {
            console.log('Timer active via real-time update:', newTimerRemaining);
            setIsTimerActive(true);
          } else {
            console.log('Timer stopped via real-time update');
            setIsTimerActive(false);
            
            // If timer reached 0, trigger match end
            if (newTimerRemaining <= 0 && isTimerActive) {
              console.log('Timer ended via real-time update, ending match');
              handleTimerEnd();
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };    }, [tournamentCode]);

  // Subscribe to real-time vote updates
  useEffect(() => {
    if (!tournamentCode || !currentMatch || !supabase) return;

    const voteChannel = supabase
      .channel(`votes-${tournamentCode}-${currentMatch.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tournament_votes',
          filter: `tournament_code=eq.${tournamentCode}`,
        },
        (payload) => {
          console.log('New vote received:', payload.new);
          // Update tallies immediately when a new vote comes in
          if (payload.new.match_id === currentMatch.id) {
            updateLiveTallies();
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(voteChannel);
      }
    };
  }, [tournamentCode, currentMatch]);

  // Host timer - updates database every second for real-time sync with voters
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTimerActive && timeRemaining > 0) {
      interval = setInterval(async () => {
        const newTime = timeRemaining - 1;
        
        if (newTime <= 0) {
          // Timer ended
          setIsTimerActive(false);
          setTimeRemaining(0);
          
          // Update database to stop timer
          try {
            await updateTimerRemaining(tournamentCode, 0);
          } catch (error) {
            console.error('Error updating timer to 0:', error);
          }
          
          // AUTO-END MATCH when timer reaches 0
          handleTimerEnd();
        } else {
          // Update database with new time so voters stay synced
          try {
            await updateTimerRemaining(tournamentCode, newTime);
          } catch (error) {
            console.error('Error updating timer in database:', error);
          }
          
          // Update local state (this will be overridden by real-time subscription anyway)
          setTimeRemaining(newTime);
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isTimerActive, timeRemaining, tournamentCode]);

  // NEW: Handle timer ending - determine winner and end match
  const handleTimerEnd = async () => {
    if (!tournament || !currentMatch || !tournamentCode) return;
    
    try {
      console.log('Timer ended, determining winner');
      
      // Get vote tallies to determine winner
      const tallies = await getVoteTalliesForMatch(tournamentCode, currentMatch.id);
      
      let winner = null;
      if (tallies.length > 0) {
        // Find participant with most votes
        const maxVotes = Math.max(...tallies.map(t => t.count));
        const winningTally = tallies.find(t => t.count === maxVotes);
        
        if (winningTally) {
          winner = currentMatch.participant1?.id === winningTally.participantId 
            ? currentMatch.participant1 
            : currentMatch.participant2;
        }
      }
      
      // If no votes or tie, default to participant1
      if (!winner) {
        winner = currentMatch.participant1 || currentMatch.participant2;
      }
      
      if (winner) {
        await handleEndMatchWithWinner(winner);
      }
      
    } catch (error) {
      console.error('Error handling timer end:', error);
    }
  };

  // Cleanup vote checking interval on unmount
  useEffect(() => {
    return () => {
      if (voteCheckInterval) {
        clearInterval(voteCheckInterval);
      }
    };
  }, [voteCheckInterval]);

  // NEW: Fetch live vote tallies
  const updateLiveTallies = async () => {
    if (!tournamentCode || !currentMatch) return;
    
    try {
      const tallies = await getVoteTalliesForMatch(tournamentCode, currentMatch.id);
      const talliesMap: {[key: string]: number} = {};
      let total = 0;
      
      tallies.forEach(tally => {
        talliesMap[tally.participantId] = tally.count;
        total += tally.count;
      });
      
      setLiveTallies(talliesMap);
      setTotalVotes(total);
    } catch (error) {
      console.error('Error fetching live tallies:', error);
    }
  };

  // Update live tallies periodically when timer is active
  useEffect(() => {
    if (!isTimerActive || !currentMatch) return;
    
    // Update immediately
    updateLiveTallies();
    
    // Then update every 2 seconds
    const interval = setInterval(updateLiveTallies, 2000);
    
    return () => clearInterval(interval);
  }, [isTimerActive, currentMatch, tournamentCode]);

  // Auto-advance matches with only one participant or handle matches with no participants
  useEffect(() => {
    if (!currentMatch || !tournament) return;
    
    // Check if this match should be auto-advanced or skipped
    const participantCount = [currentMatch.participant1, currentMatch.participant2].filter(Boolean).length;
    const maxRounds = getMaxRounds(tournament.participants.length);
    const isChampionshipMatch = currentMatch.round === maxRounds;
    
    if (participantCount === 0) {
      // No participants - this match should not occur, return to bracket immediately
      onSetCurrentScreen('bracket');
      return;
    } else if (participantCount === 1 && !isChampionshipMatch) {
      // Only one participant - auto-advance them (but NOT for championship matches)
      const winner = currentMatch.participant1 || currentMatch.participant2;
      if (winner) {
        // Small delay to show the match briefly before auto-advancing
        const autoAdvanceTimer = setTimeout(() => {
          // Update the current match with winner
          const updatedMatches = tournament.matches.map(match => 
            match.id === currentMatch.id 
              ? { ...match, winner, status: 'completed' as const }
              : match
          );

          // Advance winner to next round (only one round ahead)
          const finalMatches = advanceWinner(updatedMatches, { ...currentMatch, winner });
          
          // For regular matches, update state and return to bracket
          // Let the bracket logic determine the next match
          onUpdateGameState(prev => ({
            ...prev,
            tournament: prev.tournament ? {
              ...prev.tournament,
              matches: finalMatches,
              currentMatch: null,
              status: 'active'
            } : null
          }));
          
          // Navigate back to bracket - don't auto-advance further
          onSetCurrentScreen('bracket');
        }, 1000); // 1 second delay to show the bye/single participant

        return () => clearTimeout(autoAdvanceTimer);
      }
    }
    // If it's a championship match with only one participant, let the host manually confirm the winner
  }, [currentMatch, tournament, onUpdateGameState, onSetCurrentScreen]);

  if (!tournament || !currentMatch) return null;

  // Check if tournament is already completed
  if (tournament.status === 'completed' && !showTournamentComplete) {
    const champion = tournament.matches
      .filter(m => m.round === getMaxRounds(tournament.participants.length) && m.winner)
      .map(m => m.winner)[0];
    
    if (champion) {
      setTournamentChampion(champion);
      setShowTournamentComplete(true);
    }
  }

  // If match has no participants, show error
  if (!currentMatch.participant1 && !currentMatch.participant2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600 mb-4">Match Error</h1>
          <p className="text-xl text-gray-700 mb-8">This match has no participants.</p>
          <button
            onClick={() => onSetCurrentScreen('bracket')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg"
          >
            Return to Bracket
          </button>
        </div>
      </div>
    );
  }

  const maxRounds = getMaxRounds(tournament.participants.length);
  const currentRoundName = formatRoundName(currentMatch.round, maxRounds);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // NEW: One-click match start with immediate timer
  const handleStartMatchWithVoting = async () => {
    console.log('Button clicked! Checking conditions...');
    console.log('Tournament:', tournament);
    console.log('Current Match:', currentMatch);
    console.log('Tournament Code:', tournamentCode);
    
    if (!tournament || !currentMatch) {
      console.error('Missing tournament or currentMatch');
      return;
    }
    
    if (!tournamentCode) {
      console.error('Missing tournament code');
      return;
    }
    
    try {
      console.log('Starting match with immediate voting:', currentMatch.id);
      
      // Start match and timer in one operation
      await startMatchWithTimer(tournamentCode, tournament, tournament.roundDuration);
      
      console.log('startMatchWithTimer completed, updating local state...');
      
      // Update local state immediately
      setIsTimerActive(true);
      setTimeRemaining(tournament.roundDuration);
      setHasAccelerated(false);
      
      // Start checking for all voters voted
      startVoteChecking();
      
    } catch (error) {
      console.error('Error starting match with voting:', error);
    }
  };

  // NEW: Start checking if all voters have voted
  const startVoteChecking = () => {
    if (voteCheckInterval) {
      clearInterval(voteCheckInterval);
    }
    
    const interval = setInterval(async () => {
      if (!tournamentCode || !currentMatch || !isTimerActive) return;
      
      try {
        const voteStatus = await checkAllVotersVoted(tournamentCode, currentMatch.id);
        console.log('Vote status check:', voteStatus);
        
        // If all voters have voted and timer > 10 seconds, accelerate to 10 seconds
        if (voteStatus.allVoted && 
            voteStatus.connectedVoters > 0 && 
            timeRemaining > 10 && 
            !hasAccelerated) {
          
          console.log('All voters have voted, accelerating timer to 10 seconds');
          await accelerateTimer(tournamentCode);
          setTimeRemaining(10);
          setHasAccelerated(true);
        }
      } catch (error) {
        console.error('Error checking vote status:', error);
      }
    }, 2000); // Check every 2 seconds
    
    setVoteCheckInterval(interval);
  };

  // NEW: End match with winner celebration
  const handleEndMatchWithWinner = async (winner: any) => {
    if (!tournament || !currentMatch || !tournamentCode) return;
    
    try {
      console.log('Ending match with winner:', winner.name);
      
      // Stop vote checking
      if (voteCheckInterval) {
        clearInterval(voteCheckInterval);
        setVoteCheckInterval(null);
      }
      
      // End match and show winner
      await endMatchWithWinner(tournamentCode, tournament, winner);
      
      // Update local state
      setIsTimerActive(false);
      setTimeRemaining(0);
      setShowWinnerConfirm(false);
      setSelectedWinner(null);
      
      // Show celebration for 3 seconds then return to bracket
      setShowCelebration(true);
      setTimeout(() => {
        setShowCelebration(false);
        onSetCurrentScreen('bracket');
      }, 3000);
      
    } catch (error) {
      console.error('Error ending match with winner:', error);
    }
  };

  const handleStartTimer = () => {
    setIsTimerActive(true);
  };

  const handlePauseTimer = () => {
    setIsTimerActive(false);
  };

  const handleResetTimer = () => {
    setIsTimerActive(false);
    setTimeRemaining(tournament.roundDuration);
  };

  const handleAddTime = (seconds: number) => {
    setTimeRemaining(prev => prev + seconds);
  };

  const handleSelectWinner = (participantId: string) => {
    setSelectedWinner(participantId);
    setShowWinnerConfirm(true);
  };

  const handleConfirmWinner = async () => {
    if (!selectedWinner || !currentMatch) return;

    const winner = currentMatch.participant1?.id === selectedWinner 
      ? currentMatch.participant1 
      : currentMatch.participant2;

    if (!winner) return;

    // Use the new unified end match function
    await handleEndMatchWithWinner(winner);
  };

  const handleRandomWinner = () => {
    const participants = [currentMatch.participant1, currentMatch.participant2].filter(Boolean);
    if (participants.length === 0) return;
    
    const randomWinner = participants[Math.floor(Math.random() * participants.length)];
    if (randomWinner) {
      setSelectedWinner(randomWinner.id);
      setShowWinnerConfirm(true);
    }
  };

  const handleEndMatch = () => {
    setIsTimerActive(false);
    // Don't auto-select winner, wait for host to choose
  };

  if (showCelebration && selectedWinner) {
    const winner = currentMatch.participant1?.id === selectedWinner 
      ? currentMatch.participant1 
      : currentMatch.participant2;

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
            You have advanced to {formatRoundName(currentMatch.round + 1, maxRounds)}!
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

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Tournament Info Header */}
        {tournament && (
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-4 mb-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-2xl font-bold">{tournament.name}</h1>
                  <div className="bg-white/20 px-3 py-1 rounded-full">
                    <span className="text-sm font-medium">Code: {tournamentCode}</span>
                  </div>
                </div>
                <p className="text-white/90 text-sm">
                  {formatRoundName(tournament.currentRound, getMaxRounds(tournament.participants.length))} - Round {tournament.currentRound} of {getMaxRounds(tournament.participants.length)}
                </p>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <Users size={20} />
                  <span className="text-xl font-bold">{connectedVoters}</span>
                </div>
                <p className="text-white/90 text-sm">Connected Voters</p>
                
                {/* Live Vote Count */}
                {isTimerActive && totalVotes > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-xl font-bold">{totalVotes}</span>
                    </div>
                    <p className="text-white/90 text-sm">Votes Cast</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Return to Bracket Button */}
        <div className="mb-6">
          <button
            onClick={() => onSetCurrentScreen('bracket')}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <Trophy size={20} />
            <span>Return to Bracket</span>
          </button>
        </div>

        {/* Match Header */}
        <div className="text-center mb-8">
          <div className={`relative inline-block mb-8 ${timeRemaining === 0 && !isTimerActive ? 'animate-pulse' : ''}`}>
            <div className={`text-8xl font-black mb-4 ${
              timeRemaining > 0 && !isTimerActive 
                ? 'text-red-500' 
                : timeRemaining <= 30 
                ? 'text-orange-500' 
                : 'text-gray-800'
            }`}>
              {timeRemaining > 0 && isTimerActive 
                ? '⏰ VOTE NOW!' 
                : formatTime(timeRemaining)}
            </div>
            {timeRemaining > 0 && (
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 rounded-2xl -z-10 blur-xl"></div>
            )}
          </div>

          {/* Large Start Match Button - only show when timer is not active */}
          {!isTimerActive && (
            <div className="mb-8">
              <button
                onClick={handleStartMatchWithVoting}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-6 px-12 rounded-2xl text-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl border-2 border-green-400/50 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <Play size={32} />
                  <span>Start Match!</span>
                </div>
              </button>
            </div>
          )}
          
          {/* Visual Divider */}
          <div className="w-full flex justify-center mb-8">
            <div className="w-32 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          </div>
          
          <div className="inline-flex items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl px-8 py-4 mb-6 border border-white/40 shadow-lg">
            <div className="text-lg font-semibold text-gray-600">{currentRoundName}</div>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <div className="text-lg font-medium text-gray-700">Match {currentMatch.position + 1}</div>
          </div>
          
          {timeRemaining === 0 && !isTimerActive && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 inline-block">
              <p className="text-xl text-red-700 font-semibold">🗳️ Select the winner below</p>
            </div>
          )}
        </div>

        {/* Main Match Display - 60% of screen */}
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-3/5">
            {/* Participants */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {currentMatch.participant1 ? (
                <button
                  onClick={() => handleSelectWinner(currentMatch.participant1!.id)}
                  className="relative group bg-white hover:bg-gray-50 border-4 border-gray-200 hover:border-red-400 p-8 rounded-3xl text-center transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
                >
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <ParticipantShape visualId={currentMatch.participant1.visualId} size="xl" className="transform group-hover:scale-110 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-red-400/10 rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentMatch.participant1.name}</h2>
                      
                      {/* Live Vote Display */}
                      <div className="mb-2">
                        <div className="flex items-center justify-center gap-2 bg-red-50 rounded-lg px-4 py-2 border-2 border-red-100">
                          <div className="text-2xl font-bold text-red-600 transition-all duration-300">
                            {liveTallies[currentMatch.participant1.id] || 0}
                          </div>
                          <div className="text-sm text-red-500 font-medium">
                            {totalVotes > 0 ? `${Math.round(((liveTallies[currentMatch.participant1.id] || 0) / totalVotes) * 100)}%` : '0%'}
                          </div>
                          {(liveTallies[currentMatch.participant1.id] || 0) > 0 && (
                            <div className="flex gap-1">
                              {Array.from({ length: Math.min(liveTallies[currentMatch.participant1.id] || 0, 5) }).map((_, i) => (
                                <div 
                                  key={i} 
                                  className="w-2 h-2 bg-red-500 rounded-full animate-pulse"
                                  style={{ animationDelay: `${i * 100}ms` }}
                                />
                              ))}
                              {(liveTallies[currentMatch.participant1.id] || 0) > 5 && (
                                <div className="text-xs text-red-500 font-bold">+{(liveTallies[currentMatch.participant1.id] || 0) - 5}</div>
                              )}
                            </div>
                          )}
                        </div>
                        {totalVotes > 0 && (
                          <div className="mt-2 bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-red-400 to-red-600 h-3 rounded-full transition-all duration-700 ease-out shadow-sm"
                              style={{ 
                                width: `${((liveTallies[currentMatch.participant1.id] || 0) / totalVotes) * 100}%` 
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-red-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Click to select!
                      </div>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="bg-gray-100 border-4 border-gray-200 p-8 rounded-3xl text-center">
                  <div className="flex flex-col items-center gap-6 opacity-50">
                    <div className="w-16 h-16 bg-gray-300 rounded-full"></div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-500">No Participant</h2>
                    </div>
                  </div>
                </div>
              )}

              {currentMatch.participant2 ? (
                <button
                  onClick={() => handleSelectWinner(currentMatch.participant2!.id)}
                  className="relative group bg-white hover:bg-gray-50 border-4 border-gray-200 hover:border-yellow-400 p-8 rounded-3xl text-center transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
                >
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <ParticipantShape visualId={currentMatch.participant2.visualId} size="xl" className="transform group-hover:scale-110 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-yellow-400/10 rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentMatch.participant2.name}</h2>
                      
                      {/* Live Vote Display */}
                      <div className="mb-2">
                        <div className="flex items-center justify-center gap-2 bg-yellow-50 rounded-lg px-4 py-2 border-2 border-yellow-100">
                          <div className="text-2xl font-bold text-yellow-600 transition-all duration-300">
                            {liveTallies[currentMatch.participant2.id] || 0}
                          </div>
                          <div className="text-sm text-yellow-600 font-medium">
                            {totalVotes > 0 ? `${Math.round(((liveTallies[currentMatch.participant2.id] || 0) / totalVotes) * 100)}%` : '0%'}
                          </div>
                          {(liveTallies[currentMatch.participant2.id] || 0) > 0 && (
                            <div className="flex gap-1">
                              {Array.from({ length: Math.min(liveTallies[currentMatch.participant2.id] || 0, 5) }).map((_, i) => (
                                <div 
                                  key={i} 
                                  className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"
                                  style={{ animationDelay: `${i * 100}ms` }}
                                />
                              ))}
                              {(liveTallies[currentMatch.participant2.id] || 0) > 5 && (
                                <div className="text-xs text-yellow-600 font-bold">+{(liveTallies[currentMatch.participant2.id] || 0) - 5}</div>
                              )}
                            </div>
                          )}
                        </div>
                        {totalVotes > 0 && (
                          <div className="mt-2 bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-3 rounded-full transition-all duration-700 ease-out shadow-sm"
                              style={{ 
                                width: `${((liveTallies[currentMatch.participant2.id] || 0) / totalVotes) * 100}%` 
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-yellow-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Click to select!
                      </div>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="bg-gray-100 border-4 border-gray-200 p-8 rounded-3xl text-center">
                  <div className="flex flex-col items-center gap-6 opacity-50">
                    <div className="w-16 h-16 bg-gray-300 rounded-full"></div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-500">No Participant</h2>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Match Controls */}
            <div className="flex flex-wrap gap-3 justify-center">
              {isTimerActive ? (
                <button
                  onClick={handlePauseTimer}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
                >
                  <Pause size={20} />
                  Pause Match
                </button>
              ) : (
                <button
                  onClick={handleStartTimer}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
                >
                  <Play size={20} />
                  Start Timer
                </button>
              )}

              <button
                onClick={() => handleAddTime(30)}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                <Plus size={20} />
                +30s
              </button>

              <button
                onClick={() => handleAddTime(60)}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                <Plus size={20} />
                +1min
              </button>

              <button
                onClick={handleResetTimer}
                className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
              >
                <RotateCcw size={20} />
                Reset Match
              </button>

              <button
                onClick={handleRandomWinner}
                className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg"
              >
                <Trophy size={20} />
                Random
              </button>

              <button
                onClick={handleEndMatch}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
              >
                <Clock size={20} />
                End Match
              </button>
            </div>
          </div>

          {/* Mini Bracket - 40% of screen */}
          <div className="lg:w-2/5">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-bold mb-4 text-center text-black">Tournament Progress</h3>
              <div className="text-sm text-black">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-black">Current Round:</span>
                  <span className="font-bold text-black">{currentMatch.round} of {maxRounds}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-black">Participants:</span>
                  <span className="font-bold text-black">{tournament.participants.length}</span>
                </div>
                
                {/* Simplified bracket view */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {tournament.matches
                    .filter(m => m.round === currentMatch.round)
                    .map(match => (
                      <div
                        key={match.id}
                        className={`p-2 rounded border text-xs text-black ${
                          match.id === currentMatch.id 
                            ? 'bg-red-100 border-red-300' 
                            : match.status === 'completed'
                            ? 'bg-gray-100 border-gray-300'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="text-black">
                            {match.participant1?.name || 'TBD'}
                          </div>
                          <div className="text-xs text-black">vs</div>
                          <div className="text-black">
                            {match.participant2?.name || 'TBD'}
                          </div>
                        </div>
                        {match.winner && (
                          <div className="text-center text-xs font-bold text-black mt-1">
                            Winner: {match.winner.name}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Winner Confirmation Modal */}
      {showWinnerConfirm && selectedWinner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
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
                onClick={() => setShowWinnerConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWinner}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament Champion Celebration Modal */}
      {showTournamentComplete && tournamentChampion && (
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
                    // Navigate to bracket to show completed tournament
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
                    // Navigate to bracket to show completed tournament
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
      )}
    </div>
  );
};

export default AnonymousActiveMatch;
