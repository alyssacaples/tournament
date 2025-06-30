import React from 'react';
import { Trophy, Users } from 'lucide-react';
import ParticipantShape from '../ParticipantShape';
import { Match, Participant } from '@/types/tournament';

interface MatchDisplayProps {
  currentMatch: Match;
  liveTallies: {[key: string]: number};
  totalVotes: number;
  connectedVoters: number;
  tournamentCode: string;
}

export default function MatchDisplay({
  currentMatch,
  liveTallies,
  totalVotes,
  connectedVoters,
  tournamentCode
}: MatchDisplayProps) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2">
            <span className="text-white text-lg font-bold">Code: {tournamentCode}</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 flex items-center gap-2">
            <Users size={20} className="text-green-400" />
            <span className="text-white text-lg font-bold">{connectedVoters}</span>
          </div>
        </div>
        
        <h1 className="text-4xl font-black text-white mb-2 drop-shadow-lg">CURRENT MATCH</h1>
        <div className="text-white/80 text-lg">
          Votes: {totalVotes} / {connectedVoters}
        </div>
      </div>

      {/* Match Participants */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        {/* Participant 1 */}
        {currentMatch.participant1 && (
          <div className="text-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-6 mb-4 transform hover:scale-105 transition-all">
              <ParticipantShape 
                visualId={currentMatch.participant1.visualId} 
                size="xl" 
                className="mb-4"
              />
              <h3 className="text-2xl font-bold text-white mb-2">{currentMatch.participant1.name}</h3>
              
              {/* Live vote tally */}
              <div className="bg-blue-500/30 rounded-xl p-3">
                <div className="text-3xl font-black text-white mb-1">
                  {liveTallies[currentMatch.participant1.id] || 0}
                </div>
                <div className="text-blue-200 text-sm font-medium">votes</div>
              </div>
            </div>
          </div>
        )}

        {/* VS */}
        <div className="text-center">
          <div className="text-6xl font-black text-white mb-4 drop-shadow-lg animate-pulse">
            VS
          </div>
          <Trophy className="mx-auto text-yellow-400 animate-bounce" size={48} />
        </div>

        {/* Participant 2 */}
        {currentMatch.participant2 && (
          <div className="text-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-6 mb-4 transform hover:scale-105 transition-all">
              <ParticipantShape 
                visualId={currentMatch.participant2.visualId} 
                size="xl" 
                className="mb-4"
              />
              <h3 className="text-2xl font-bold text-white mb-2">{currentMatch.participant2.name}</h3>
              
              {/* Live vote tally */}
              <div className="bg-red-500/30 rounded-xl p-3">
                <div className="text-3xl font-black text-white mb-1">
                  {liveTallies[currentMatch.participant2.id] || 0}
                </div>
                <div className="text-red-200 text-sm font-medium">votes</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
