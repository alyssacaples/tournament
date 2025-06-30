import { useEffect } from 'react';
import { Match } from '@/types/tournament';
import { getVoteTalliesForMatch } from '@/utils/supabase';

interface VoteTallyManagerProps {
  currentMatch: Match | null;
  tournamentCode: string;
  isTimerActive: boolean;
  onTalliesUpdate: (tallies: {[key: string]: number}, total: number) => void;
}

export default function VoteTallyManager({
  currentMatch,
  tournamentCode,
  isTimerActive,
  onTalliesUpdate
}: VoteTallyManagerProps) {
  // Update live tallies periodically when timer is active
  useEffect(() => {
    if (!isTimerActive || !currentMatch) return;
    
    const updateLiveTallies = async () => {
      try {
        const talliesArray = await getVoteTalliesForMatch(tournamentCode, currentMatch.id);
        const tallies: {[key: string]: number} = {};
        let total = 0;
        
        talliesArray.forEach(tally => {
          tallies[tally.participantId] = tally.count;
          total += tally.count;
        });
        
        onTalliesUpdate(tallies, total);
      } catch (error) {
        console.error('Error updating live tallies:', error);
      }
    };

    updateLiveTallies();
    const interval = setInterval(updateLiveTallies, 2000);
    
    return () => clearInterval(interval);
  }, [isTimerActive, currentMatch, tournamentCode, onTalliesUpdate]);

  return null; // This component doesn't render anything
}
