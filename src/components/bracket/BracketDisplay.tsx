import React, { useEffect, useState } from 'react';
import { Trophy, Play } from 'lucide-react';
import { Match, Tournament } from '@/types/tournament';
import { formatRoundName } from '@/utils/tournament';
import ParticipantShape from '../ParticipantShape';

interface BracketDisplayProps {
  tournament: Tournament;
  matchesByRound: Record<number, Match[]>;
  maxRounds: number;
  onStartMatch?: (match: Match) => void;
}

export default function BracketDisplay({
  tournament,
  matchesByRound,
  maxRounds,
  onStartMatch
}: BracketDisplayProps) {
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    if (typeof window !== 'undefined') {
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, []);

  // Calculate responsive sizing based on actual viewport
  const availableWidth = dimensions.width - 48; // Account for padding
  const availableHeight = dimensions.height - 200; // Account for header and controls
  const roundWidth = Math.max(200, Math.floor(availableWidth / maxRounds)); // Minimum 200px per round
  const maxMatchesInAnyRound = Math.max(...Object.values(matchesByRound).map(matches => matches.length));
  const matchHeight = Math.max(100, Math.min(140, Math.floor((availableHeight - 120) / Math.max(maxMatchesInAnyRound, 1)))); // 100-140px match height
  
  return (
    <div className="w-full h-full flex overflow-x-auto overflow-y-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="flex min-w-full" style={{ minWidth: `${maxRounds * 200}px` }}>
        {Array.from({ length: maxRounds }, (_, i) => i + 1).map(round => {
        const roundMatches = matchesByRound[round] || [];
        const isFirstRound = round === 1;
        const isFinalRound = round === maxRounds;
        
        return (
          <div 
            key={round} 
            className="flex flex-col px-3" // Added horizontal padding
            style={{ 
              width: `${roundWidth}px`,
              minWidth: `${Math.max(200, roundWidth)}px`
            }}
          >
            {/* Round Header */}
            <div className="py-2 text-center border-b border-white/10">
              <h3 className={`font-bold text-white mb-1 flex items-center justify-center gap-1 ${
                roundWidth < 200 ? 'text-sm' : 'text-lg'
              }`}>
                {isFinalRound ? (
                  <Trophy className={`text-yellow-400 ${roundWidth < 200 ? 'w-3 h-3' : 'w-4 h-4'}`} />
                ) : null}
                <span className={roundWidth < 180 ? 'hidden' : ''}>{formatRoundName(round, maxRounds)}</span>
                {roundWidth < 180 && <span>R{round}</span>}
              </h3>
              <div className={`text-white/60 ${roundWidth < 200 ? 'text-xs' : 'text-sm'}`}>
                {roundMatches.filter(m => m.status === 'completed').length}/{roundMatches.length}
              </div>
            </div>

            {/* Matches Container */}
            <div className="flex-1 flex flex-col justify-center gap-3 py-4 px-2"> {/* Increased gap and padding */}
              {roundMatches.map((match, index) => {
                const canStart = match.status === 'pending' && match.participant1 && match.participant2 && onStartMatch;
                const isNextMatch = !tournament.currentMatch && canStart;
                
                return (
                  <div
                    key={match.id}
                    className={`
                      relative border-2 rounded transition-all duration-300 cursor-pointer
                      ${match.status === 'completed' 
                        ? 'border-gray-500 bg-gray-500/10 opacity-80' 
                        : match === tournament.currentMatch
                          ? 'border-red-500 bg-red-500/20 ring-1 ring-red-500/50 scale-105 animate-pulse'
                          : isNextMatch
                            ? 'border-yellow-400 bg-yellow-400/20 animate-pulse hover:scale-105'
                            : canStart
                              ? 'border-green-500 bg-green-500/10 hover:border-green-400 hover:scale-105'
                              : 'border-white/30 bg-white/5'
                      }
                    `}
                    onClick={canStart ? () => onStartMatch(match) : undefined}
                    style={{
                      height: `${matchHeight}px`,
                      minHeight: '100px' // Ensure minimum height
                    }}
                  >
                    {/* Match Content */}
                    <div className="h-full flex flex-col justify-center p-1">
                      {/* Participant 1 */}
                      <div className={`flex items-center gap-1 px-1 py-1 rounded text-xs ${
                        match.winner?.id === match.participant1?.id 
                          ? 'bg-green-600/40 border border-green-500/60 font-bold' 
                          : 'bg-white/10'
                      }`}>
                        {match.participant1 ? (
                          <>
                            {roundWidth > 180 && (
                              <ParticipantShape visualId={match.participant1.visualId} size="sm" />
                            )}
                            <span className="text-white truncate flex-1" style={{ fontSize: roundWidth < 200 ? '10px' : '12px' }}>
                              {roundWidth < 160 ? match.participant1.name.substring(0, 8) + '...' : match.participant1.name}
                            </span>
                            {match.winner?.id === match.participant1?.id && (
                              <Trophy className="w-2 h-2 text-yellow-400 flex-shrink-0" />
                            )}
                          </>
                        ) : (
                          <span className="text-white/50 italic text-xs">TBD</span>
                        )}
                      </div>
                      
                      {/* VS - Only show if there's space */}
                      {matchHeight > 80 && (
                        <div className="text-center">
                          <span className="text-white/60 text-xs font-semibold">VS</span>
                        </div>
                      )}
                      
                      {/* Participant 2 */}
                      <div className={`flex items-center gap-1 px-1 py-1 rounded text-xs ${
                        match.winner?.id === match.participant2?.id 
                          ? 'bg-green-600/40 border border-green-500/60 font-bold' 
                          : 'bg-white/10'
                      }`}>
                        {match.participant2 ? (
                          <>
                            {roundWidth > 180 && (
                              <ParticipantShape visualId={match.participant2.visualId} size="sm" />
                            )}
                            <span className="text-white truncate flex-1" style={{ fontSize: roundWidth < 200 ? '10px' : '12px' }}>
                              {roundWidth < 160 ? match.participant2.name.substring(0, 8) + '...' : match.participant2.name}
                            </span>
                            {match.winner?.id === match.participant2?.id && (
                              <Trophy className="w-2 h-2 text-yellow-400 flex-shrink-0" />
                            )}
                          </>
                        ) : (
                          <span className="text-white/50 italic text-xs">TBD</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Match Status/Action - Only show if there's space */}
                    {matchHeight > 90 && (
                      <div className="absolute bottom-1 left-1 right-1 text-center">
                        {match.status === 'completed' ? (
                          <div className="text-xs text-green-400 font-semibold">✓</div>
                        ) : match === tournament.currentMatch ? (
                          <div className="text-xs text-red-400 font-bold animate-pulse">🔴</div>
                        ) : canStart ? (
                          <button className="w-full bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-1 rounded transition-colors">
                            {roundWidth > 160 ? (
                              <>
                                <Play className="w-2 h-2 inline mr-1" />
                                START
                              </>
                            ) : (
                              '▶'
                            )}
                          </button>
                        ) : null}
                      </div>
                    )}
                    
                    {/* Connection Lines to Next Round */}
                    {!isFinalRound && match.status === 'completed' && roundWidth > 160 && (
                      <div className="absolute right-0 top-1/2 w-2 h-0.5 bg-white/30 transform translate-x-full -translate-y-1/2" />
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Champion Display */}
            {isFinalRound && roundMatches[0]?.winner && (
              <div className="p-2 text-center border-t border-white/10">
                <div className="bg-yellow-400/20 border border-yellow-400 rounded p-2">
                  <Trophy className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                  <div className="text-yellow-400 font-bold text-xs">CHAMPION</div>
                  <div className="text-white font-bold text-sm truncate">{roundMatches[0].winner.name}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
