'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, generateTournamentCode } from '@/utils/supabase';
import { parseParticipantInput } from '@/utils/tournament';
import { AnonymousParticipant } from '@/types/interactive';
import { SHAPE_COLOR_COMBOS } from '@/data/constants';

export default function AnonymousHostPage() {
  const router = useRouter();
  const [tournamentName, setTournamentName] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(16);
  const [roundDuration, setRoundDuration] = useState(120);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateTournament = async () => {
    if (!tournamentName.trim()) {
      setError('Please enter a tournament name');
      return;
    }

    if (!participantInput.trim()) {
      setError('Please enter participant names');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Parse participant names
      const participantNames = parseParticipantInput(participantInput);
      
      if (participantNames.length < 2) {
        setError('At least 2 participants required');
        setIsCreating(false);
        return;
      }

      if (participantNames.length > maxParticipants) {
        setError(`Too many participants. Maximum is ${maxParticipants}`);
        setIsCreating(false);
        return;
      }

      // Create participants with visual IDs
      const participants: AnonymousParticipant[] = participantNames.map((name, index) => ({
        id: `participant-${index}`,
        name,
        visualId: index % SHAPE_COLOR_COMBOS.length
      }));

      // Generate tournament code
      let code = generateTournamentCode();
      
      // Check if code exists (unlikely but possible)
      let { data: existingTournament } = await supabase
        .from('tournaments')
        .select('id')
        .eq('code', code)
        .single();

      // Generate new code if collision
      while (existingTournament) {
        code = generateTournamentCode();
        const { data } = await supabase
          .from('tournaments')
          .select('id')
          .eq('code', code)
          .single();
        existingTournament = data;
      }

      // Create tournament in database
      const { data: tournament, error: dbError } = await supabase
        .from('tournaments')
        .insert({
          code,
          name: tournamentName.trim(),
          mode: 'anonymous',
          status: 'waiting',
          participants,
          matches: [],
          current_match_id: null,
          current_round: 1,
          max_participants: maxParticipants,
          round_duration: roundDuration,
          host_last_seen: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        setError('Failed to create tournament. Please try again.');
        setIsCreating(false);
        return;
      }

      // Store tournament ID in localStorage for host reconnection
      localStorage.setItem('anonymous_tournament_id', tournament.id);
      localStorage.setItem('anonymous_tournament_code', code);
      localStorage.setItem('anonymous_host_role', 'true');

      // Navigate to tournament management
      router.push(`/anonymous/manage/${tournament.id}`);

    } catch (err) {
      console.error('Error creating tournament:', err);
      setError('Failed to create tournament. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Create Anonymous Tournament
            </h1>
            <p className="text-gray-600">
              Set up a tournament where people can vote anonymously on their devices
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tournament Name
              </label>
              <input
                type="text"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                placeholder="e.g., Cocktail Competition 2025"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isCreating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Participants (one per line or comma-separated)
              </label>
              <textarea
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                placeholder="Mojito&#10;Old Fashioned&#10;Margarita&#10;Whiskey Sour"
                rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                disabled={isCreating}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Participants
                </label>
                <select
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isCreating}
                >
                  <option value={8}>8</option>
                  <option value={16}>16</option>
                  <option value={32}>32</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Round Duration (seconds)
                </label>
                <select
                  value={roundDuration}
                  onChange={(e) => setRoundDuration(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isCreating}
                >
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                  <option value={180}>3 minutes</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCreateTournament}
              disabled={isCreating}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating Tournament...' : 'Create Tournament'}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
