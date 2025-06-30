'use client';

import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface VoteConnectionStatusProps {
  isConnected: boolean;
}

export default function VoteConnectionStatus({ isConnected }: VoteConnectionStatusProps) {
  const [showOffline, setShowOffline] = useState(!isConnected);
  
  useEffect(() => {
    if (isConnected) {
      // When connection is restored, show the connected status briefly
      setShowOffline(false);
    } else {
      // When disconnected, show the offline status
      setShowOffline(true);
    }
  }, [isConnected]);
  
  if (!showOffline && isConnected) {
    return null;
  }
  
  return (
    <div className={`
      fixed top-4 right-4 p-2 rounded-full 
      ${isConnected ? 'bg-green-500' : 'bg-red-500'} 
      ${isConnected ? 'animate-fade-out' : 'animate-pulse'}
    `}>
      {isConnected ? (
        <Wifi size={20} className="text-white" />
      ) : (
        <WifiOff size={20} className="text-white" />
      )}
    </div>
  );
}

// Add CSS for animation
const styles = `
@keyframes fade-out {
  0% { opacity: 1; }
  90% { opacity: 1; }
  100% { opacity: 0; }
}

.animate-fade-out {
  animation: fade-out 3s forwards;
}
`;

// Insert styles into document
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}
