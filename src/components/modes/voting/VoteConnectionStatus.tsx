import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface VoteConnectionStatusProps {
  isConnected: boolean;
}

export default function VoteConnectionStatus({ isConnected }: VoteConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {isConnected ? (
        <>
          <Wifi size={16} className="text-green-400" />
          <span className="text-green-400">Connected</span>
        </>
      ) : (
        <>
          <WifiOff size={16} className="text-red-400" />
          <span className="text-red-400">Disconnected</span>
        </>
      )}
    </div>
  );
}
