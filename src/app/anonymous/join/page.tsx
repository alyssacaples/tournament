'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, generateSessionId, createOrUpdateConnection, testDatabaseConnection, logSupabaseOperation } from '@/utils/supabase';

export default function AnonymousJoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCodeChange = (value: string) => {
    // Only allow alphanumeric characters and convert to uppercase
    const cleanValue = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (cleanValue.length <= 4) {
      setCode(cleanValue);
      setError('');
      
      // Auto-submit when 4 characters entered
      if (cleanValue.length === 4) {
        handleJoinTournament(cleanValue);
      }
    }
  };

  const handleJoinTournament = async (tournamentCode?: string) => {
    const codeToUse = tournamentCode || code;
    if (codeToUse.length !== 4) return;

    setIsJoining(true);
    setError('');

    try {
      logSupabaseOperation('Join Tournament - Start', { code: codeToUse });
      
      // Test database connection first
      const isConnected = await testDatabaseConnection();
      if (!isConnected) {
        setError('Unable to connect to tournament server. Please check your internet connection.');
        setIsJoining(false);
        return;
      }

      // Check if tournament exists and is active
      const { data: tournament, error: dbError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('code', codeToUse)
        .eq('mode', 'anonymous')
        .single();

      if (dbError || !tournament) {
        logSupabaseOperation('Tournament Lookup', { code: codeToUse }, dbError);
        setError('Tournament not found. Please check your code.');
        setIsJoining(false);
        return;
      }

      if (tournament.status === 'completed') {
        setError('This tournament has already ended.');
        setIsJoining(false);
        return;
      }

      logSupabaseOperation('Tournament Found', tournament);

      // Generate or get session ID
      let sessionId = localStorage.getItem('anonymous_session_id');
      if (!sessionId) {
        sessionId = generateSessionId();
        localStorage.setItem('anonymous_session_id', sessionId);
        logSupabaseOperation('Session Created', { sessionId });
      } else {
        logSupabaseOperation('Session Retrieved', { sessionId });
      }

      // Create or update connection using enhanced method
      const connectionSuccess = await createOrUpdateConnection(tournament.id, sessionId);
      
      if (!connectionSuccess) {
        setError('Failed to join tournament. Please try again.');
        setIsJoining(false);
        return;
      }

      // Store tournament info
      localStorage.setItem('anonymous_tournament_id', tournament.id);
      localStorage.setItem('anonymous_tournament_code', codeToUse);

      logSupabaseOperation('Join Tournament - Success', { tournamentId: tournament.id, sessionId });

      // Navigate to voting interface
      router.push(`/anonymous/vote/${tournament.id}`);

    } catch (err) {
      logSupabaseOperation('Join Tournament', { code: codeToUse }, err);
      setError('Failed to join tournament. Please try again.');
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Join Tournament
          </h1>
          <p className="text-gray-600">
            Enter the 4-character code shown on the main screen
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Tournament Code
          </label>
          <div className="relative">
            <input
              type="text"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="ABCD"
              className="w-full text-center text-3xl font-bold tracking-widest border-2 border-gray-300 rounded-lg py-4 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              disabled={isJoining}
              autoFocus
            />
            {code.length > 0 && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="text-sm text-gray-500">
                  {code.length}/4
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 text-center">
            {error}
          </div>
        )}

        {isJoining && (
          <div className="text-center text-blue-600 mb-6">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2">Joining tournament...</p>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => router.push('/')}
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
