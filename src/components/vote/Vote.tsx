'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, Users, CheckCircle, Clock, Trophy, Wifi, WifiOff } from 'lucide-react';
import { supabase, getTournamentByCode, connectVoter, updateVoterPing, disconnectVoter, submitVote } from '@/utils/supabase';
import { Tournament, Match, Participant } from '@/types/tournament';
import ParticipantShape from '@/components/ParticipantShape';

export default function Vote() {
  const [currentScreen, setCurrentScreen] = useState<'join' | 'waiting' | 'match-waiting' | 'voting' | 'host-disconnected' | 'champion'>('join');
  const [tournamentCode, setTournamentCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hostConnected, setHostConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [showNewMatchAnimation, setShowNewMatchAnimation] = useState(false);
  const [showWinnerCelebration, setShowWinnerCelebration] = useState(false);
  const [matchWinner, setMatchWinner] = useState<any>(null);
  const [voterId] = useState(`voter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const router = useRouter();

  // Keep voter connection alive with periodic pings
  useEffect(() => {
    if (!tournamentCode || !voterId) return;

    const pingInterval = setInterval(async () => {
      try {
        await updateVoterPing(tournamentCode, voterId);
        // If ping is successful, ensure we're marked as connected
        setIsConnected(true);
      } catch (error) {
        console.error('Error updating voter ping:', error);
        // If ping fails, mark as disconnected
        setIsConnected(false);
      }
    }, 1500); // Ping every 1.5 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(pingInterval);
      if (tournamentCode && voterId) {
        disconnectVoter(tournamentCode, voterId).catch(console.error);
      }
    };
  }, [tournamentCode, voterId]);  // Join tournament
  const handleJoinTournament = async (codeToUse?: string) => {
    const code = codeToUse || inputCode;
    if (code.length !== 4) {
      setError('Please enter a 4-character code');
      return;
    }

    try {
      setError(null);
      const tournamentData = await getTournamentByCode(code.toUpperCase());
      
      if (!tournamentData) {
        setError('Tournament not found. Please check the code.');
        return;
      }

      console.log('=== TOURNAMENT DATA RETRIEVED ===');
      console.log('Raw tournament data from DB:', tournamentData);
      console.log('Tournament object:', tournamentData.tournament_data);
      console.log('Tournament status in object:', tournamentData.tournament_data?.status);
      console.log('Database status field:', tournamentData.status);
      console.log('=== END TOURNAMENT DATA ===');

      setTournament(tournamentData.tournament_data);
      setTournamentCode(code.toUpperCase());
      
      // Connect voter to tournament - this is what was missing!
      await connectVoter(code.toUpperCase(), voterId);
      
      // Set connected immediately after successful database connection
      setIsConnected(true);
      
      // Don't set screen to 'waiting' immediately - let the useEffect handle screen determination
      // based on the actual tournament state
      
      // Connect to real-time updates
      connectToTournament(code.toUpperCase());
    } catch (error) {
      console.error('Error joining tournament:', error);
      // Reset connection status on join failure
      setIsConnected(false);
      setError('Code not recognized. Please try again.');
    }
  };

  // Handle initial tournament state after joining
  useEffect(() => {
    if (!tournament) return;

    console.log('=== TOURNAMENT STATE EVALUATION ===');
    console.log('Tournament status:', tournament.status);
    console.log('Tournament currentMatch:', tournament.currentMatch);
    console.log('Tournament matches:', tournament.matches?.length || 0, 'total');
    console.log('Completed matches:', tournament.matches?.filter(m => m.status === 'completed').length || 0);
    console.log('Active matches:', tournament.matches?.filter(m => m.status === 'active').length || 0);
    console.log('Pending matches:', tournament.matches?.filter(m => m.status === 'pending').length || 0);
    
    // Check initial state and set appropriate screen
    if (tournament.status === 'completed') {
      console.log('-> Setting screen to CHAMPION');
      setCurrentScreen('champion');
    } else if (tournament.status === 'active') {
      if (tournament.currentMatch) {
        console.log('-> Setting screen to VOTING (active match found)');
        setCurrentMatch(tournament.currentMatch);
        setCurrentScreen('voting');
      } else {
        console.log('-> Setting screen to MATCH-WAITING (tournament active, no current match)');
        const nextMatch = tournament.matches.find(m => m.status === 'pending');
        setNextMatch(nextMatch || null);
        setCurrentScreen('match-waiting');
      }
    } else {
      // Check if tournament has actually started even if status isn't 'active'
      const completedMatches = tournament.matches?.filter(m => m.status === 'completed').length || 0;
      const activeMatches = tournament.matches?.filter(m => m.status === 'active').length || 0;
      
      if (completedMatches > 0 || activeMatches > 0) {
        console.log('-> Tournament has activity despite status being', tournament.status, '- treating as active');
        if (tournament.currentMatch) {
          console.log('-> Setting screen to VOTING (current match exists)');
          setCurrentMatch(tournament.currentMatch);
          setCurrentScreen('voting');
        } else {
          console.log('-> Setting screen to MATCH-WAITING (tournament has activity, no current match)');
          const nextMatch = tournament.matches.find(m => m.status === 'pending');
          setNextMatch(nextMatch || null);
          setCurrentScreen('match-waiting');
        }
      } else {
        console.log('-> Setting screen to WAITING (tournament status:', tournament.status, ')');
        setCurrentScreen('waiting');
      }
    }
    console.log('=== END EVALUATION ===');
  }, [tournament]);

  // Connect to tournament real-time updates
  const connectToTournament = (code: string) => {
    if (!supabase) return () => {};
    
    // Subscribe to tournament updates
    const tournamentChannel = supabase
      .channel(`tournament-${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `code=eq.${code}`
        },
        (payload) => {
          console.log('=== REAL-TIME TOURNAMENT UPDATE ===');
          console.log('Raw payload:', payload.new);
          const updatedTournament = payload.new.tournament_data as Tournament;
          console.log('Updated tournament status:', updatedTournament.status);
          console.log('Updated tournament currentMatch:', updatedTournament.currentMatch);
          setTournament(updatedTournament);
          
          // Check for winner celebration first
          if (updatedTournament.lastMatchWinner) {
            console.log('Match winner detected:', updatedTournament.lastMatchWinner);
            setMatchWinner(updatedTournament.lastMatchWinner);
            setShowWinnerCelebration(true);
            
            // Auto-hide celebration after 3 seconds and return to appropriate screen
            setTimeout(() => {
              setShowWinnerCelebration(false);
              setMatchWinner(null);
              
              // Determine next screen based on tournament status
              if (updatedTournament.status === 'completed') {
                setCurrentScreen('champion');
              } else {
                setCurrentScreen('match-waiting');
              }
            }, 3000);
            return; // Don't process other state changes during celebration
          }
          
          // Determine the correct screen based on tournament state
          if (updatedTournament.status === 'completed') {
            console.log('-> Real-time: Tournament completed, showing champion screen');
            setCurrentScreen('champion');
          } else if (updatedTournament.status === 'active') {
            // Tournament is active - check if there's a current match
            if (updatedTournament.currentMatch) {
              console.log('-> Real-time: Active match detected, switching to voting');
              setCurrentMatch(updatedTournament.currentMatch);
              setCurrentScreen('voting');
              // Reset voting state for new match only if it's a different match
              if (currentMatch?.id !== updatedTournament.currentMatch.id) {
                console.log('New match started, resetting vote state');
                console.log('Old match ID:', currentMatch?.id);
                console.log('New match ID:', updatedTournament.currentMatch.id);
                setHasVoted(false);
                setSelectedVote(null);
                console.log('Reset selectedVote to null for new match');
                // Show new match animation for 20 seconds
                setShowNewMatchAnimation(true);
                setTimeout(() => setShowNewMatchAnimation(false), 20000);
              }
            } else {
              // Tournament is active but no current match - show next match waiting
              console.log('-> Real-time: Tournament active but no current match, switching to match-waiting');
              const nextMatch = updatedTournament.matches.find(m => m.status === 'pending');
              setNextMatch(nextMatch || null);
              setCurrentScreen('match-waiting');
            }
          } else {
            // Tournament is still in setup/waiting
            console.log('-> Real-time: Tournament in setup/waiting mode, staying on waiting screen');
            console.log('   Current tournament status:', updatedTournament.status);
            setCurrentScreen('waiting');
          }
          console.log('=== END REAL-TIME UPDATE ===');
        }
      )
      .subscribe((status) => {
        console.log('Tournament subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setHostConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsConnected(false);
          // If disconnected for too long, assume host is gone
          setTimeout(() => {
            // Check if still disconnected after 10 seconds
            setIsConnected(current => {
              if (!current) {
                setHostConnected(false);
                setCurrentScreen('host-disconnected');
              }
              return current;
            });
          }, 10000); // 10 seconds timeout
        }
      });

    // Subscribe to timer updates
    const timerChannel = supabase
      .channel(`timer-${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `code=eq.${code}`
        },
        (payload) => {
          console.log('Timer update received:', {
            timer_remaining: payload.new.timer_remaining,
            timer_active: payload.new.timer_active
          });
          
          const newTimeRemaining = payload.new.timer_remaining || 0;
          const newTimerActive = payload.new.timer_active || false;
          
          setTimeRemaining(newTimeRemaining);
          setIsTimerActive(newTimerActive);
          
          // If timer just started, ensure we're in voting mode
          if (newTimerActive && !isTimerActive && currentMatch) {
            console.log('Timer started for match, ensuring voting screen');
            setCurrentScreen('voting');
          }
          
          // If timer ended, voter can no longer change their vote
          if (!newTimerActive && isTimerActive) {
            console.log('Timer ended, voting locked');
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(tournamentChannel);
        supabase.removeChannel(timerChannel);
      }
    };
  };

  // Submit vote
  const handleVote = async (participantId: string) => {
    if (!currentMatch || !tournament || !supabase) return;

    console.log('=== HANDLE VOTE ===');
    console.log('participantId:', participantId);
    console.log('current selectedVote:', selectedVote);
    console.log('hasVoted:', hasVoted);

    // If already voted for this participant, don't submit again
    if (hasVoted && selectedVote === participantId) return;

    // Always set the selected vote first for immediate visual feedback
    setSelectedVote(participantId);
    console.log('Set selectedVote to:', participantId);

    // If changing vote or voting for first time, submit the vote
    try {
      await submitVote(tournamentCode, currentMatch.id, participantId, voterId);
      
      if (!hasVoted) {
        setHasVoted(true);
        console.log('Set hasVoted to true');
        // Show brief confirmation for first vote
        setNotification('✅ Vote submitted!');
        setTimeout(() => setNotification(null), 2000);
      } else {
        // Show brief confirmation for vote change
        setNotification('✅ Vote changed!');
        setTimeout(() => setNotification(null), 2000);
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
      setError('Failed to submit vote. Please try again.');
      // Reset selection on error only
      setSelectedVote(null);
      console.log('Reset selectedVote due to error');
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle input code change (auto-submit when 4 characters)
  const handleInputChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setInputCode(upperValue);
    
    if (upperValue.length === 4) {
      // Auto-attempt to join immediately when 4 characters are entered
      setError(null); // Clear any previous errors
      handleJoinTournament(upperValue);
    }
  };

  // Winner Celebration Screen (shown for 3 seconds)
  if (showWinnerCelebration && matchWinner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-orange-500 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Celebratory decorations */}
        <div className="absolute top-10 left-10 text-4xl animate-bounce">🎉</div>
        <div className="absolute top-20 right-10 text-4xl animate-pulse">✨</div>
        <div className="absolute bottom-20 left-16 text-4xl animate-spin">🎊</div>
        <div className="absolute bottom-32 right-20 text-4xl animate-bounce">🏆</div>
        
        <div className="text-center relative z-10">
          <div className="text-8xl mb-6 animate-bounce">🎉</div>
          <h1 className="text-5xl font-black text-white mb-4 drop-shadow-2xl">
            WINNER!
          </h1>
          
          <div className="bg-white rounded-3xl p-8 shadow-2xl mb-6 transform hover:scale-105 transition-transform">
            <div className="flex flex-col items-center gap-6">
              <ParticipantShape 
                visualId={matchWinner.visualId} 
                size="xl" 
                className="transform scale-150 animate-pulse"
              />
              <h2 className="text-4xl font-black text-gray-800">{matchWinner.name}</h2>
              <div className="text-2xl font-bold text-yellow-600 animate-bounce">
                🎉 CHAMPION! 🎉
              </div>
            </div>
          </div>
          
          <div className="text-white text-xl drop-shadow-lg">
            Returning to tournament...
          </div>
        </div>
      </div>
    );
  }

  // Join Screen
  if (currentScreen === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">📱</div>
            <h1 className="text-3xl font-bold text-white mb-2">Join Tournament</h1>
            <p className="text-purple-100">Enter the 4-character code to start voting</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-3">Tournament Code</label>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full text-center text-4xl font-black tracking-widest border-2 border-gray-300 rounded-xl py-4 px-4 focus:border-purple-500 focus:outline-none uppercase"
                placeholder="ABCD"
                maxLength={4}
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={() => handleJoinTournament()}
              disabled={inputCode.length !== 4}
              className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-xl text-lg transition-colors"
            >
              Join Tournament
            </button>
          </div>

          <div className="text-center mt-6">
            <p className="text-purple-100 text-sm">
              Get the code from the tournament host
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Screen
  if (currentScreen === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-cyan-600 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <div className="text-6xl mb-4 animate-bounce">⏳</div>
            <h1 className="text-3xl font-bold text-white mb-2">Waiting for Tournament</h1>
            <p className="text-white/80">You&apos;re connected and ready to vote!</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700">Tournament:</span>
              <span className="font-bold text-gray-900">{tournament?.name}</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-700">Code:</span>
              <span className="font-black text-2xl text-purple-600">{tournamentCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Connection:</span>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="text-green-500" size={16} />
                    <span className="text-green-600 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="text-red-500" size={16} />
                    <span className="text-red-600 font-medium">Disconnected</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <p className="text-white text-sm">
              The tournament hasn't started yet. The host will begin when ready. 
              Keep this page open to vote on matches.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Match Waiting Screen - Tournament active but waiting for next match
  if (currentScreen === 'match-waiting') {
    // Check if this is the first match or a subsequent match
    const completedMatches = tournament?.matches.filter(m => m.status === 'completed').length || 0;
    const activeMatches = tournament?.matches.filter(m => m.status === 'active').length || 0;
    const isFirstMatch = completedMatches === 0 && activeMatches === 0;
    
    // Determine if voter joined late vs was waiting from the beginning
    const joinedLate = completedMatches > 0 || activeMatches > 0;
    
    let title, subtitle, emoji;
    
    if (joinedLate) {
      title = 'Tournament In Progress';
      subtitle = 'Waiting for match to start';
      emoji = '⏰';
    } else if (isFirstMatch) {
      title = 'Tournament has Started!';
      subtitle = 'Waiting for Host to start first match';
      emoji = '🎯';
    } else {
      title = 'Next Match Coming Up!';
      subtitle = 'Get ready to vote';
      emoji = '⚡';
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-500 to-orange-500 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <div className="text-6xl mb-4 animate-pulse">{emoji}</div>
            <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
            <p className="text-white/80">{subtitle}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
            <div className="text-gray-700 mb-4 font-semibold">Up Next:</div>
            
            {nextMatch && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-col items-center">
                    <ParticipantShape visualId={nextMatch.participant1?.visualId || 0} size="lg" />
                    <span className="text-sm font-medium mt-2">{nextMatch.participant1?.name}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-400">VS</div>
                  <div className="flex flex-col items-center">
                    <ParticipantShape visualId={nextMatch.participant2?.visualId || 0} size="lg" />
                    <span className="text-sm font-medium mt-2">{nextMatch.participant2?.name}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Show additional info for late joiners */}
          {joinedLate && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
              <div className="text-white text-sm">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Trophy size={16} />
                  <span className="font-medium">Tournament Progress</span>
                </div>
                <div className="text-white/80 space-y-1">
                  <p>{completedMatches} match{completedMatches === 1 ? '' : 'es'} completed</p>
                  {activeMatches > 0 && (
                    <p>{activeMatches} match{activeMatches === 1 ? '' : 'es'} currently active</p>
                  )}
                  <p className="text-yellow-200 font-medium">You can vote on upcoming matches!</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center justify-center gap-2 text-white">
              <Clock size={16} />
              <span className="text-sm">
                {joinedLate ? 'Waiting for next match to start' : 'The host will start the match soon'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Host Disconnected Screen
  if (currentScreen === 'host-disconnected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-pink-600 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <div className="text-6xl mb-4">😔</div>
            <h1 className="text-3xl font-bold text-white mb-2">Host Disconnected</h1>
            <p className="text-white/80">The tournament host has left the game</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-2xl mb-6">
            <div className="text-gray-700 mb-4">
              <p className="mb-2">The tournament has been interrupted because the host disconnected.</p>
              <p className="text-sm text-gray-500">You can join a new tournament by entering a different code.</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-white text-red-600 font-bold py-4 rounded-xl text-lg hover:bg-gray-100 transition-colors"
          >
            Join New Tournament
          </button>
        </div>
      </div>
    );
  }

  // Voting Screen - Enhanced with playful design
  if (currentScreen === 'voting' && currentMatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex flex-col p-4">
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-300 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-32 right-16 w-12 h-12 bg-blue-300 rounded-full opacity-30 animate-bounce"></div>
        <div className="absolute bottom-20 left-20 w-16 h-16 bg-green-300 rounded-full opacity-25 animate-ping"></div>
        
        {/* Header */}
        <div className="text-center mb-6 relative z-10">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-2 bg-white/30 backdrop-blur-sm rounded-full px-4 py-2">
              {isConnected ? (
                <Wifi className="text-white" size={16} />
              ) : (
                <WifiOff className="text-white" size={16} />
              )}
            </div>
            <div className="bg-white/30 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-white font-bold tracking-wider">{tournamentCode}</span>
            </div>
          </div>
          
          <div className="text-7xl font-black text-white mb-4 drop-shadow-lg">
            VOTE
          </div>
          
          <div className={`text-4xl font-black text-white mb-2 ${
            timeRemaining <= 10 && timeRemaining > 0 ? 'animate-pulse text-yellow-200' : 
            timeRemaining === 0 && !isTimerActive ? 'text-red-200' : ''
          }`}>
            {!isTimerActive && timeRemaining === 0 ? 
              '⏰ VOTING ENDED' : 
              timeRemaining === 0 ? '⏰ STARTING...' : 
              formatTime(timeRemaining)
            }
          </div>

          {isTimerActive && (
            <div className="text-yellow-200 font-semibold animate-bounce">
              VOTE NOW
            </div>
          )}
          
          {isTimerActive && timeRemaining <= 10 && timeRemaining > 0 && (
            <div className="text-yellow-200 font-semibold animate-bounce">
              🔥 Final seconds to change your vote! 🔥
            </div>
          )}
          
          {!isTimerActive && timeRemaining === 0 && (
            <div className="text-red-200 font-semibold">
              🔒 Voting is closed for this match
            </div>
          )}
          
          {!isTimerActive && timeRemaining > 0 && (
            <div className="text-white/80 font-semibold animate-pulse">
              ⏳ Get ready to vote...
            </div>
          )}
          
          {/* Beautiful New Match Star Animation - appears behind content for 20 seconds */}
          {showNewMatchAnimation && (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
              {/* Multiple animated stars with different timings */}
              {[...Array(15)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-yellow-300 text-lg animate-pulse"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                    opacity: 0.6 + Math.random() * 0.4
                  }}
                >
                  ✨
                </div>
              ))}
            
              
              {/* Additional floating stars for more magic */}
              {[...Array(8)].map((_, i) => (
                <div
                  key={`star-${i}`}
                  className="absolute text-white text-sm animate-bounce"
                  style={{
                    left: `${10 + Math.random() * 80}%`,
                    top: `${10 + Math.random() * 80}%`,
                    animationDelay: `${Math.random() * 4}s`,
                    animationDuration: `${1.5 + Math.random() * 1.5}s`,
                    opacity: 0.4 + Math.random() * 0.3
                  }}
                >
                  ⭐
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Voting Options */}
        <div className="flex-1 flex flex-col gap-6 relative z-10">
          {currentMatch.participant1 && (
            <button
              onClick={() => handleVote(currentMatch.participant1!.id)}
              disabled={!isTimerActive}
              className={`flex-1 rounded-3xl p-6 shadow-2xl transition-all transform active:scale-95 hover:shadow-3xl ${
                selectedVote === currentMatch.participant1.id
                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 ring-8 ring-yellow-300 ring-opacity-50 scale-105 shadow-yellow-300/50'
                  : 'bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700'
              } ${
                selectedVote === currentMatch.participant1.id 
                  ? '' 
                  : (!isTimerActive ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105')
              }`}
            >
              <div className="flex flex-col items-center gap-4">
                <ParticipantShape 
                  visualId={currentMatch.participant1.visualId} 
                  size="xl" 
                  className={`transform transition-all duration-300 ${
                    selectedVote === currentMatch.participant1.id 
                      ? 'scale-125 animate-pulse drop-shadow-xl' 
                      : 'hover:scale-110'
                  }`}
                />
                <h2 className={`text-2xl font-bold drop-shadow-md transition-all duration-300 ${
                  selectedVote === currentMatch.participant1.id 
                    ? 'text-yellow-900 text-3xl' 
                    : 'text-white'
                }`}>
                  {currentMatch.participant1.name}
                </h2>
                {selectedVote === currentMatch.participant1.id && (
                  <div className="flex items-center gap-2 text-yellow-900 animate-bounce">
                    <CheckCircle size={24} className="drop-shadow-lg" />
                    <span className="font-bold text-lg drop-shadow-lg">SELECTED!</span>
                  </div>
                )}
              </div>
            </button>
          )}

          <div className="text-center py-4">
            <div className="text-white text-4xl font-black drop-shadow-lg animate-pulse">VS</div>
          </div>

          {currentMatch.participant2 && (
            <button
              onClick={() => handleVote(currentMatch.participant2!.id)}
              disabled={!isTimerActive}
              className={`flex-1 rounded-3xl p-6 shadow-2xl transition-all transform active:scale-95 hover:shadow-3xl ${
                selectedVote === currentMatch.participant2.id
                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 ring-8 ring-yellow-300 ring-opacity-50 scale-105 shadow-yellow-300/50'
                  : 'bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700'
              } ${
                selectedVote === currentMatch.participant2.id 
                  ? '' 
                  : (!isTimerActive ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105')
              }`}
            >
              <div className="flex flex-col items-center gap-4">
                <ParticipantShape 
                  visualId={currentMatch.participant2.visualId} 
                  size="xl" 
                  className={`transform transition-all duration-300 ${
                    selectedVote === currentMatch.participant2.id 
                      ? 'scale-125 animate-pulse drop-shadow-xl' 
                      : 'hover:scale-110'
                  }`}
                />
                <h2 className={`text-2xl font-bold drop-shadow-md transition-all duration-300 ${
                  selectedVote === currentMatch.participant2.id 
                    ? 'text-yellow-900 text-3xl' 
                    : 'text-white'
                }`}>
                  {currentMatch.participant2.name}
                </h2>
                {selectedVote === currentMatch.participant2.id && (
                  <div className="flex items-center gap-2 text-yellow-900 animate-bounce">
                    <CheckCircle size={24} className="drop-shadow-lg" />
                    <span className="font-bold text-lg drop-shadow-lg">SELECTED!</span>
                  </div>
                )}
              </div>
            </button>
          )}
        </div>

        {/* Status Bar */}
        <div className="mt-6 bg-white/20 backdrop-blur-sm rounded-2xl p-4 relative z-10">
          <div className="flex items-center justify-between text-white text-sm">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span className="font-medium">{isTimerActive ? 'Voting Active' : 'Voting Paused'}</span>
            </div>
            <div className="flex items-center gap-2">
              {hasVoted ? (
                <>
                  <CheckCircle size={16} className="text-yellow-300" />
                  <span className="font-medium">Vote Submitted!</span>
                </>
              ) : (
                <>
                  <Users size={16} />
                  <span className="font-medium">Tap to Vote</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Champion Screen - Tournament Complete!
  if (currentScreen === 'champion') {
    const champion = tournament?.matches
      .filter(m => m.status === 'completed' && m.winner)
      .sort((a, b) => b.round - a.round)[0]?.winner;

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-orange-500 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Celebratory decorations */}
        <div className="absolute top-10 left-10 text-4xl animate-bounce">🎉</div>
        <div className="absolute top-20 right-10 text-4xl animate-pulse">✨</div>
        <div className="absolute bottom-20 left-16 text-4xl animate-spin">🎊</div>
        <div className="absolute bottom-32 right-20 text-4xl animate-bounce">🏆</div>
        
        <div className="text-center relative z-10">
          <div className="text-8xl mb-6 animate-bounce">🏆</div>
          <h1 className="text-5xl font-black text-white mb-4 drop-shadow-2xl">
            CHAMPION!
          </h1>
          
          {champion && (
            <div className="bg-white rounded-3xl p-8 shadow-2xl mb-6 transform hover:scale-105 transition-transform">
              <div className="flex flex-col items-center gap-6">
                <ParticipantShape 
                  visualId={champion.visualId} 
                  size="xl" 
                  className="transform scale-150 animate-pulse"
                />
                <h2 className="text-4xl font-black text-gray-800">{champion.name}</h2>
                <div className="text-2xl font-bold text-yellow-600 animate-bounce">
                  🎉 WINNER! 🎉
                </div>
              </div>
            </div>
          )}
          
          <div className="text-white space-y-2">
            <p className="text-2xl font-bold drop-shadow-lg">{tournament?.name}</p>
            <p className="text-white/90 text-lg">Tournament Complete!</p>
            <p className="text-white/80">Thanks for voting!</p>
          </div>

          <button
            onClick={() => router.push('/')}
            className="mt-8 bg-white text-orange-600 font-bold py-4 px-8 rounded-2xl text-lg hover:bg-gray-100 transition-colors transform hover:scale-105"
          >
            Join New Tournament
          </button>
        </div>
      </div>
    );
  }

  return null;
}
