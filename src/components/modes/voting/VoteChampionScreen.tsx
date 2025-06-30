import React from 'react';
import { useRouter } from 'next/navigation';
import { Tournament } from '@/types/tournament';
import ParticipantShape from '@/components/ParticipantShape';

interface VoteChampionScreenProps {
  tournament: Tournament | null;
}

export default function VoteChampionScreen({ tournament }: VoteChampionScreenProps) {
  const router = useRouter();
  
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
            </div>
          </div>
        )}

        <p className="text-white text-xl font-bold drop-shadow-lg mb-8">
          Tournament Complete!
        </p>

        <button
          onClick={() => router.push('/')}
          className="bg-white text-orange-600 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-colors shadow-2xl"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
