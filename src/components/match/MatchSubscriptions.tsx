import { useEffect } from 'react';
import { supabase } from '@/utils/supabase';

interface MatchSubscriptionsProps {
  tournamentCode: string;
  currentMatchId: string | null;
  isTimerActive: boolean;
  onTimerUpdate: (remaining: number, active: boolean) => void;
  onTimerEnd: () => void;
  onVoteUpdate: () => void;
}

export default function MatchSubscriptions({
  tournamentCode,
  currentMatchId,
  isTimerActive,
  onTimerUpdate,
  onTimerEnd,
  onVoteUpdate
}: MatchSubscriptionsProps) {
  // Subscribe to tournament timer updates
  useEffect(() => {
    if (!tournamentCode || !supabase) return;

    const channel = supabase
      .channel(`tournament-${tournamentCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `code=eq.${tournamentCode}`
        },
        (payload) => {
          const newTimerActive = payload.new.timer_active;
          const newTimerRemaining = payload.new.timer_remaining || 0;
          
          onTimerUpdate(newTimerRemaining, newTimerActive && newTimerRemaining > 0);
          
          if (newTimerRemaining <= 0 && isTimerActive) {
            onTimerEnd();
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [tournamentCode, isTimerActive, onTimerUpdate, onTimerEnd]);

  // Subscribe to real-time vote updates
  useEffect(() => {
    if (!tournamentCode || !currentMatchId || !supabase) return;

    const voteChannel = supabase
      .channel(`votes-${tournamentCode}-${currentMatchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tournament_votes',
          filter: `tournament_code=eq.${tournamentCode}`,
        },
        (payload) => {
          if (payload.new.match_id === currentMatchId) {
            onVoteUpdate();
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(voteChannel);
      }
    };
  }, [tournamentCode, currentMatchId, onVoteUpdate]);

  return null; // This component doesn't render anything
}
