import React from 'react';
import { Pause, Play, RotateCcw, Plus } from 'lucide-react';

interface MatchTimerControlsProps {
  timeRemaining: number;
  isTimerActive: boolean;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResetTimer: () => void;
  onAddTime: (seconds: number) => void;
}

export default function MatchTimerControls({
  timeRemaining,
  isTimerActive,
  onStartTimer,
  onPauseTimer,
  onResetTimer,
  onAddTime
}: MatchTimerControlsProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
      <div className="text-center mb-6">
        <div className={`relative inline-block mb-8 ${timeRemaining === 0 && !isTimerActive ? 'animate-pulse' : ''}`}>
          <div className={`text-8xl font-black ${
            timeRemaining > 0 && !isTimerActive 
              ? 'text-yellow-300' 
              : timeRemaining <= 30 
                ? 'text-red-300' 
                : 'text-white'
          }`}>
            {timeRemaining > 0 && isTimerActive 
              ? formatTime(timeRemaining)
              : formatTime(timeRemaining)}
          </div>
          {timeRemaining > 0 && (
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
              <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                isTimerActive 
                  ? 'bg-green-500 text-white' 
                  : 'bg-yellow-500 text-black'
              }`}>
                {isTimerActive ? 'ACTIVE' : 'PAUSED'}
              </div>
            </div>
          )}
        </div>

        {timeRemaining === 0 && !isTimerActive && (
          <div className="text-red-300 text-2xl font-bold mb-4 animate-pulse">
            ⏰ TIME&apos;S UP!
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        {!isTimerActive && timeRemaining > 0 && (
          <button
            onClick={onStartTimer}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
          >
            <Play size={20} />
            Start Timer
          </button>
        )}

        {isTimerActive && (
          <button
            onClick={onPauseTimer}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-xl font-bold transition-colors"
          >
            <Pause size={20} />
            Pause Timer
          </button>
        )}

        <button
          onClick={onResetTimer}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
        >
          <RotateCcw size={20} />
          Reset Timer
        </button>

        <button
          onClick={() => onAddTime(30)}
          className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
        >
          <Plus size={20} />
          +30s
        </button>

        <button
          onClick={() => onAddTime(60)}
          className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
        >
          <Plus size={20} />
          +1min
        </button>
      </div>
    </div>
  );
}
