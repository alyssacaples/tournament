'use client';

import React, { useState } from 'react';

interface VoteJoinScreenProps {
  initialCode: string;
  onJoinTournament: (code: string) => void;
}

export default function VoteJoinScreen({ initialCode, onJoinTournament }: VoteJoinScreenProps) {
  const [code, setCode] = useState(initialCode || '');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
    setCode(value);
    setError('');
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 4) {
      setError('Tournament code must be 4 characters');
      return;
    }
    
    setIsJoining(true);
    
    try {
      await onJoinTournament(code);
    } catch (err) {
      setError('Failed to join tournament. Please check your code and try again.');
      setIsJoining(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center text-white mb-6">
          Join Tournament
        </h1>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-white p-4 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-white mb-2">
              Enter Tournament Code
            </label>
            
            <input
              type="text"
              id="code"
              value={code}
              onChange={handleCodeChange}
              placeholder="XXXX"
              className="w-full text-center text-4xl tracking-widest font-mono py-4 rounded-lg bg-white/20 text-white placeholder-white/40 border-2 border-white/30 focus:border-yellow-400 focus:outline-none"
              autoFocus
              inputMode="text"
            />
          </div>
          
          <button
            type="submit"
            disabled={isJoining || code.length !== 4}
            className={`w-full py-4 rounded-lg text-lg font-bold transition-colors
              ${isJoining || code.length !== 4
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-yellow-500 hover:bg-yellow-400 text-black'
              }
            `}
          >
            {isJoining ? 'Joining...' : 'Join Tournament'}
          </button>
        </form>
      </div>
    </div>
  );
}
