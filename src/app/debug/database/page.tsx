'use client';

import { useState, useEffect } from 'react';
import { testDatabaseConnection, supabase, logSupabaseOperation } from '@/utils/supabase';

export default function DatabaseHealthPage() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'failed'>('testing');
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    runHealthCheck();
  }, []);

  const runHealthCheck = async () => {
    setConnectionStatus('testing');
    setError('');
    setStats(null);

    try {
      // Test basic connection
      const isConnected = await testDatabaseConnection();
      
      if (!isConnected) {
        setConnectionStatus('failed');
        setError('Database connection failed');
        return;
      }

      // Get database statistics
      const [tournamentsResult, connectionsResult, votesResult] = await Promise.all([
        supabase.from('tournaments').select('*', { count: 'exact', head: true }),
        supabase.from('connections').select('*', { count: 'exact', head: true }),
        supabase.from('votes').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        tournaments: tournamentsResult.count || 0,
        connections: connectionsResult.count || 0,
        votes: votesResult.count || 0
      });

      setConnectionStatus('connected');
      logSupabaseOperation('Health Check - Success', stats);

    } catch (err) {
      setConnectionStatus('failed');
      setError(err instanceof Error ? err.message : 'Unknown error');
      logSupabaseOperation('Health Check', null, err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Database Health Check</h1>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Connection Status:</span>
            <div className="flex items-center gap-2">
              {connectionStatus === 'testing' && (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-yellow-600">Testing...</span>
                </>
              )}
              {connectionStatus === 'connected' && (
                <>
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span className="text-green-600">Connected</span>
                </>
              )}
              {connectionStatus === 'failed' && (
                <>
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span className="text-red-600">Failed</span>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}

          {stats && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Database Statistics:</h3>
              <div className="space-y-1 text-sm">
                <div>Tournaments: {stats.tournaments}</div>
                <div>Active Connections: {stats.connections}</div>
                <div>Total Votes: {stats.votes}</div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={runHealthCheck}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg"
            >
              Run Test Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
