import { useEffect } from 'react';
import { Tournament, Match } from '@/types/tournament';
import { supabase } from '@/utils/supabase';

interface MatchStateManagerProps {
  tournament: Tournament | null;
  currentMatch: Match | null;
  tournamentCode: string;
  onTimerUpdate: (remaining: number, active: boolean) => void;
  onTalliesReset: () => void;
  onAcceleratedReset: () => void;
}

export default function MatchStateManager({
  tournament,
  currentMatch,
  tournamentCode,
  onTimerUpdate,
  onTalliesReset,
  onAcceleratedReset
}: MatchStateManagerProps) {
  // Initialize timer and reset state for new match
  useEffect(() => {
    if (tournament && currentMatch) {
      onTimerUpdate(tournament.roundDuration, false);
      onTalliesReset();
      onAcceleratedReset();
    }
  }, [tournament, currentMatch, onTimerUpdate, onTalliesReset, onAcceleratedReset]);

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
          onTimerUpdate(data.timer_remaining, true);
        }
      } catch (error) {
        console.error('Error checking timer state:', error);
      }
    };
    
    checkTimerState();
  }, [tournamentCode, onTimerUpdate]);

  return null; // This component doesn't render anything
}
