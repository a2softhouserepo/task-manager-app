'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

interface AsanaSyncContextType {
  /** Indica se há atualizações pendentes */
  hasUpdates: boolean;
  /** Timestamp da última atualização conhecida */
  lastUpdate: string | null;
  /** Força uma verificação de atualizações */
  checkNow: () => Promise<boolean>;
  /** Indica se o polling está ativo */
  isPollingActive: boolean;
  /** Intervalo de polling em ms */
  pollingInterval: number;
  /** Notifica o context que os dados foram recarregados */
  markAsRead: () => void;
}

const AsanaSyncContext = createContext<AsanaSyncContextType | undefined>(undefined);

// Páginas onde o polling deve estar ativo
const POLLING_ENABLED_PATHS = ['/tasks', '/dashboard'];

// Intervalo padrão de polling (3 segundos)
const DEFAULT_POLLING_INTERVAL = 3000;

export function AsanaSyncProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  
  const [hasUpdates, setHasUpdates] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState(DEFAULT_POLLING_INTERVAL);
  const [isPollingActive, setIsPollingActive] = useState(false);
  
  // Refs para evitar stale closures
  const lastUpdateRef = useRef<string | null>(null);
  const isCheckingRef = useRef(false);
  
  // Sincroniza ref com state
  useEffect(() => {
    lastUpdateRef.current = lastUpdate;
  }, [lastUpdate]);

  // Verifica se o polling deve estar ativo baseado na rota e autenticação
  const shouldPoll = useCallback(() => {
    if (status !== 'authenticated') return false;
    return POLLING_ENABLED_PATHS.some(path => pathname?.startsWith(path));
  }, [status, pathname]);

  // Carrega configuração de polling do backend
  useEffect(() => {
    async function loadPollingConfig() {
      try {
        const res = await fetch('/api/settings/asana');
        if (res.ok) {
          const data = await res.json();
          const intervalSeconds = data.pollingIntervalSeconds || 3;
          setPollingInterval(intervalSeconds * 1000);
        }
      } catch (error) {
        console.debug('[ASANA SYNC] Using default polling interval');
      }
    }
    
    if (status === 'authenticated') {
      loadPollingConfig();
    }
  }, [status]);

  // Função para verificar atualizações
  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    // Evita verificações simultâneas
    if (isCheckingRef.current) return false;
    isCheckingRef.current = true;
    
    try {
      const currentLastUpdate = lastUpdateRef.current;
      const url = currentLastUpdate
        ? `/api/tasks/updates?since=${encodeURIComponent(currentLastUpdate)}`
        : '/api/tasks/updates';
      
      const res = await fetch(url);
      if (!res.ok) {
        isCheckingRef.current = false;
        return false;
      }
      
      const data = await res.json();
      
      const newUpdatesDetected = data.hasUpdates || (!currentLastUpdate && data.lastUpdate);
      
      if (newUpdatesDetected) {
        console.log('[ASANA SYNC] Updates detected');
        setHasUpdates(true);
      }
      
      // Atualiza o timestamp conhecido
      if (data.lastUpdate && data.lastUpdate !== currentLastUpdate) {
        setLastUpdate(data.lastUpdate);
      }
      
      isCheckingRef.current = false;
      return newUpdatesDetected;
    } catch (error) {
      console.debug('[ASANA SYNC] Error checking for updates:', error);
      isCheckingRef.current = false;
      return false;
    }
  }, []);

  // Marca as atualizações como lidas (chamado após reload dos dados)
  const markAsRead = useCallback(() => {
    setHasUpdates(false);
  }, []);

  // Gerencia o polling baseado na rota e autenticação
  useEffect(() => {
    const active = shouldPoll();
    setIsPollingActive(active);
    
    if (!active) {
      console.debug('[ASANA SYNC] Polling disabled - not on tasks/dashboard or not authenticated');
      return;
    }

    console.log(`[ASANA SYNC] Polling enabled on ${pathname} (interval: ${pollingInterval}ms)`);

    // Verificação inicial após pequeno delay
    const initialTimeout = setTimeout(checkForUpdates, 1000);
    
    // Configura o interval
    const intervalId = setInterval(checkForUpdates, pollingInterval);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [shouldPoll, pathname, pollingInterval, checkForUpdates]);

  const value: AsanaSyncContextType = {
    hasUpdates,
    lastUpdate,
    checkNow: checkForUpdates,
    isPollingActive,
    pollingInterval,
    markAsRead,
  };

  return (
    <AsanaSyncContext.Provider value={value}>
      {children}
    </AsanaSyncContext.Provider>
  );
}

export function useAsanaSync() {
  const context = useContext(AsanaSyncContext);
  if (context === undefined) {
    throw new Error('useAsanaSync must be used within an AsanaSyncProvider');
  }
  return context;
}

/**
 * Hook para páginas que precisam reagir a atualizações do Asana
 * Automaticamente recarrega dados quando há atualizações
 */
export function useAsanaSyncedData(reloadFn: () => Promise<void>) {
  const { hasUpdates, markAsRead, lastUpdate } = useAsanaSync();
  const hasReloadedRef = useRef(false);
  
  useEffect(() => {
    if (hasUpdates && !hasReloadedRef.current) {
      hasReloadedRef.current = true;
      console.log('[ASANA SYNC] Reloading data due to updates...');
      reloadFn().then(() => {
        markAsRead();
        hasReloadedRef.current = false;
      });
    }
  }, [hasUpdates, reloadFn, markAsRead]);
  
  return { lastUpdate };
}
