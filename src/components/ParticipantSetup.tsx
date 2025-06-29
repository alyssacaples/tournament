'use client';

import React, { useState } from 'react';
import { ArrowLeft, Users, Plus } from 'lucide-react';
import { parseParticipantInput } from '@/utils/tournament';

interface ParticipantSetupProps {
  onCreateTournament: (name: string, participants: string[], seeded: boolean) => void;
  onBack: () => void;
}

const ParticipantSetup: React.FC<ParticipantSetupProps> = ({ onCreateTournament, onBack }) => {
  const [tournamentName, setTournamentName] = useState('');
  const [participantInput, setParticipantInput] = useState('');
  const [participantCount, setParticipantCount] = useState(8);
  const [inputMode, setInputMode] = useState<'paste' | 'count'>('paste');
  const [seeded, setSeeded] = useState(false);

  const handleSubmit = () => {
    if (!tournamentName.trim()) {
      alert('Please enter a tournament name');
      return;
    }

    let participants: string[] = [];
    
    if (inputMode === 'paste') {
      participants = parseParticipantInput(participantInput);
      if (participants.length < 2) {
        alert('Please enter at least 2 participants');
        return;
      }
      if (participants.length > 32) {
        alert('Maximum 32 participants allowed');
        return;
      }
    } else {
      if (participantCount < 2 || participantCount > 32) {
        alert('Please enter between 2 and 32 participants');
        return;
      }
      participants = Array.from({ length: participantCount }, (_, i) => `Player ${i + 1}`);
    }

    onCreateTournament(tournamentName, participants, seeded);
  };

  const parsedParticipants = inputMode === 'paste' ? parseParticipantInput(participantInput) : [];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft size={20} />
          Back to Home
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Tournament Setup</h1>
          
          {/* Tournament Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tournament Name
            </label>
            <input
              type="text"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter tournament name..."
            />
          </div>

          {/* Input Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              How would you like to add participants?
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setInputMode('paste')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border ${
                  inputMode === 'paste'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Plus size={16} />
                Enter Names
              </button>
              <button
                onClick={() => setInputMode('count')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md border ${
                  inputMode === 'count'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Users size={16} />
                Set Count
              </button>
            </div>
          </div>

          {/* Participant Input */}
          {inputMode === 'paste' ? (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Participant Names
              </label>
              <textarea
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter participant names separated by commas, spaces, or new lines..."
              />
              {parsedParticipants.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  Found {parsedParticipants.length} participants: {parsedParticipants.slice(0, 3).join(', ')}
                  {parsedParticipants.length > 3 && ` and ${parsedParticipants.length - 3} more...`}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Participants (2-32)
              </label>
              <input
                type="number"
                min="2"
                max="32"
                value={participantCount}
                onChange={(e) => setParticipantCount(parseInt(e.target.value) || 2)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-2 text-sm text-gray-600">
                Participants will be named Player 1, Player 2, etc.
              </div>
            </div>
          )}

          {/* Seeding Option */}
          <div className="mb-6">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={seeded}
                onChange={(e) => setSeeded(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Enable Seeding</span>
                <p className="text-xs text-gray-500">
                  {seeded 
                    ? "Participants will be arranged by rank order (first = highest seed). Best players get byes."
                    : "Participants will be randomly shuffled. Byes are assigned randomly."
                  }
                </p>
              </div>
            </label>
          </div>

          {/* Create Tournament Button */}
          <button
            onClick={handleSubmit}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-md text-lg transition-colors"
          >
            Create Tournament
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParticipantSetup;
