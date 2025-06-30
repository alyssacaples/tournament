import React from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone } from 'lucide-react';

interface VoteJoinScreenProps {
  inputCode: string;
  setInputCode: (code: string) => void;
  error: string | null;
  onJoinTournament: () => void;
}

export default function VoteJoinScreen({ 
  inputCode, 
  setInputCode, 
  error, 
  onJoinTournament 
}: VoteJoinScreenProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <Smartphone className="mx-auto mb-4 text-blue-500" size={64} />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Join Tournament</h1>
          <p className="text-gray-600">Enter the 4-character code to vote</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input
            type="text"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none uppercase tracking-widest"
            maxLength={4}
            autoFocus
          />
          <button
            onClick={onJoinTournament}
            disabled={inputCode.length !== 4}
            className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold text-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Join Tournament
          </button>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-blue-500 hover:text-blue-700 font-medium"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
