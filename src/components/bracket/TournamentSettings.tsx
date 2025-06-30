import React from 'react';
import { Settings, Home, RotateCcw, X } from 'lucide-react';

interface TournamentSettingsProps {
  showSettings: boolean;
  roundDuration: number;
  onShowSettings: (show: boolean) => void;
  onUpdateRoundDuration: (duration: number) => void;
  onGoHome: () => void;
  onGoToSetup: () => void;
}

export default function TournamentSettings({
  showSettings,
  roundDuration,
  onShowSettings,
  onUpdateRoundDuration,
  onGoHome,
  onGoToSetup
}: TournamentSettingsProps) {
  return (
    <>
      {/* Settings Button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => onShowSettings(!showSettings)}
          className="p-3 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-colors border border-white/20"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Tournament Settings</h3>
              <button
                onClick={() => onShowSettings(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Round Duration (seconds)
                </label>
                <input
                  type="number"
                  value={roundDuration}
                  onChange={(e) => onUpdateRoundDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="30"
                  max="300"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={onGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Home
                </button>
                
                <button
                  onClick={onGoToSetup}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Setup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
