'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import HomeScreen from '@/components/HomeScreen';

export default function Home() {
  const router = useRouter();

  const startLocalMode = () => {
    router.push('/local');
  };

  const startTestMode = () => {
    router.push('/test');
  };

  const startAnonymousMode = () => {
    router.push('/anonymous/host');
  };

  const joinVoteMode = () => {
    router.push('/vote');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-100 via-yellow-50 to-red-100">
      <HomeScreen 
        onStartLocal={startLocalMode}
        onStartTest={startTestMode}
        onStartAnonymous={startAnonymousMode}
        onJoinVote={joinVoteMode}
      />
    </main>
  );
}
