import React from 'react';
import { WifiOff, HardDrive } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-banner"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500/95 text-black px-3.5 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md border border-amber-400/50 animate-in fade-in slide-in-from-bottom-3"
    >
      <WifiOff size={15} className="shrink-0 animate-pulse text-black" />
      <span>Modalità Offline — L'app funziona al 100% con i dati salvati sul dispositivo.</span>
      <HardDrive size={13} className="shrink-0 text-black/70 ml-1" />
    </div>
  );
};
