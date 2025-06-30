'use client';

import React from 'react';
import { formatTime } from '@/utils/tournament';

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
  // Convert seconds to minutes and seconds
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  
  // Format with leading zeros
  const displayTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Change color based on time remaining
  const getTimerColor = () => {
    if (timeRemaining <= 10) return 'text-red-500';
    if (timeRemaining <= 30) return 'text-yellow-500';
    return 'text-white';
  };
  
  return (
    <div className="bg-gray-800 border-b border-white/10 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className={`text-2xl font-mono font-bold ${getTimerColor()}`}>
          {displayTime}
        </div>
        
        <div className="flex space-x-2">
          {!isTimerActive ? (
            <button
              onClick={onStartTimer}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
            >
              Start
            </button>
          ) : (
            <button
              onClick={onPauseTimer}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
            >
              Pause
            </button>
          )}
          
          <button
            onClick={onResetTimer}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
          >
            Reset
          </button>
        </div>
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={() => onAddTime(30)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
        >
          +30s
        </button>
        <button
          onClick={() => onAddTime(60)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
        >
          +1m
        </button>
      </div>
    </div>
  );
}
