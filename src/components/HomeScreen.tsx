'use client';

import React from 'react';
import { Play, TestTube, Users, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HomeScreenProps {
  onStartLocal: () => void;
  onStartTest: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onStartLocal, onStartTest }) => {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-6xl">
        {/* Logo/Title with colorful accents */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-full"></div>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full"></div>
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full"></div>
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full"></div>
          </div>
          <h1 className="text-7xl font-black text-gray-800 mb-4 tracking-tight">
            TOURNAMENT
          </h1>
          <div className="w-32 h-1 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 mx-auto rounded-full"></div>
        </div>
        
        <p className="text-2xl text-gray-600 mb-16 font-medium">
          Create and manage interactive tournaments with style
        </p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 justify-center items-stretch mb-16">
          <button
            onClick={onStartLocal}
            className="group relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl h-48 flex items-center justify-center px-6"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white/20 rounded-full">
                <Play size={32} />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold mb-1">Local Tournament</div>
                <div className="text-base font-normal opacity-90">Host controls everything</div>
              </div>
            </div>
          </button>
          
          <button
            onClick={onStartTest}
            className="group relative overflow-hidden bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl h-48 flex items-center justify-center px-6"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white/20 rounded-full">
                <TestTube size={32} />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold mb-1">Test Mode</div>
                <div className="text-base font-normal opacity-90">Quick breakfast tournament</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/anonymous/host')}
            className="group relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl border-2 border-white/20 h-48 flex items-center justify-center px-6"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white/20 rounded-full">
                <Users size={32} />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold mb-1">Host Voting</div>
                <div className="text-base font-normal opacity-90">Interactive tournament</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/anonymous/join')}
            className="group relative overflow-hidden bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold rounded-2xl text-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl border-2 border-white/20 h-48 flex items-center justify-center px-6"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white/20 rounded-full">
                <Smartphone size={32} />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold mb-1">Join & Vote</div>
                <div className="text-base font-normal opacity-90">Enter tournament code</div>
              </div>
            </div>
          </button>
        </div>
        
        {/* Debug link in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-8">
            <button
              onClick={() => router.push('/debug/database')}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              🔧 Database Health Check
            </button>
          </div>
        )}
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 text-left max-w-6xl mx-auto">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/40">
            <h3 className="font-bold text-blue-600 mb-2">🏆 Local Tournament</h3>
            <p className="text-gray-700">Set up your own participants and manage matches manually. Perfect for in-person events where you control the voting.</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/40">
            <h3 className="font-bold text-green-600 mb-2">🧪 Test Mode</h3>
            <p className="text-gray-700">Instant tournament with random breakfast items. Great for testing functionality and seeing how tournaments work.</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/40">
            <h3 className="font-bold text-indigo-600 mb-2">📱 Host Voting</h3>
            <p className="text-gray-700">Create an interactive tournament where people vote on their phones. Perfect for large groups and remote participation.</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/40">
            <h3 className="font-bold text-pink-600 mb-2">🗳️ Join & Vote</h3>
            <p className="text-gray-700">Use your phone to join a tournament and vote for your favorites. Just enter the 4-character code from the host screen.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
