import React, { createContext, useContext } from 'react';
import { useSyncPendentes } from '../hooks/useSyncPendentes';

interface SyncContextType {
  pendentesCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncTime: Date | null;
  sincronizar: () => Promise<number | undefined>;
  atualizarCount: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const sync = useSyncPendentes();
  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within SyncProvider');
  return context;
}
