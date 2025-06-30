'use client';

import React from 'react';

export default function VoteMatchWaitingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 max-w-md w-full text-center">
        <div className="animate-pulse mb-6">
          <div className="w-16 h-16 mx-auto border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-3">
          Waiting for next match...
        </h1>
        
        <p className="text-white/70">
          The host is preparing the next match. Please standby!
        </p>
      </div>
    </div>
  );
}
