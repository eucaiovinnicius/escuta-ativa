import { useEffect, useState, useCallback, useRef } from 'react';
import { getPesquisasPendentes, markAsSynced, markAsError } from '../services/storage';
import { sbSyncPendentes } from '../services/supabaseService';
import { isSupabaseEnabled } from '../lib/supabase';
import { useNetworkStatus } from './useNetworkStatus';

const WEBHOOK_URL   = import.meta.env.VITE_WEBHOOK_URL || '';
const USE_API       = import.meta.env.VITE_USE_API === 'true';
const SYNC_INTERVAL = 5 * 60 * 1000;

export function useSyncPendentes() {
  const [pendentesCount, setPendentesCount]   = useState(0);
  const [isSyncing, setIsSyncing]             = useState(false);
  const [ultimoSync, setUltimoSync]           = useState<Date | null>(null);
  const [syncErros, setSyncErros]             = useState(0);
  const syncingRef = useRef(false);

  const { isOnline, wasOffline } = useNetworkStatus();

  const atualizarCount = useCallback(() => {
    setPendentesCount(getPesquisasPendentes().length);
  }, []);

  const sincronizar = useCallback(async (): Promise<number> => {
    if (syncingRef.current || !isOnline) { atualizarCount(); return 0; }
    if (!USE_API && !isSupabaseEnabled()) { atualizarCount(); return 0; }

    const pendentes = getPesquisasPendentes();
    if (pendentes.length === 0) { setPendentesCount(0); return 0; }

    syncingRef.current = true;
    setIsSyncing(true);
    let sincronizadas = 0;
    let erros = 0;

    let errorDetailsList: string[] = [];

    // ── Caminho 1: Supabase direto (preferencial) ──────────────────
    if (isSupabaseEnabled()) {
      const resultado = await sbSyncPendentes(pendentes);
      sincronizadas = resultado.ok.length;
      erros = resultado.err.length;
      resultado.ok.forEach(id => markAsSynced(id));
      resultado.err.forEach(errRet => {
        markAsError(errRet.id);
        errorDetailsList.push(errRet.message);
        console.error(`[Sync] Falha na pesquisa ${errRet.id}:`, errRet.message);
      });
    }
    // ── Caminho 2: Webhook N8N (fallback) ──────────────────────────
    else if (USE_API && WEBHOOK_URL) {
      for (const pesquisa of pendentes) {
        if (!navigator.onLine) break;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const response = await window.fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evento: 'nova_pesquisa',
              timestamp: pesquisa.timestamp,
              sistema_versao: '1.0',
              pesquisa: {
                id: pesquisa.id,
                servidor: { id: pesquisa.servidor_id, nome: pesquisa.servidor_nome },
                supervisor_id: pesquisa.supervisor_id,
                morador: pesquisa.morador,
                respostas: pesquisa.respostas,
                atendimento: pesquisa.atendimento,
              },
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (response.ok) { markAsSynced(pesquisa.id); sincronizadas++; }
          else             { markAsError(pesquisa.id);  erros++; }
        } catch {
          markAsError(pesquisa.id);
          erros++;
          break;
        }
      }
    }

    syncingRef.current = false;
    setIsSyncing(false);
    setSyncErros(erros);
    setUltimoSync(new Date());
    atualizarCount();

    // Pass detailed error info through the event if there are any
    const eventDetails: any = { 
      sincronizadas, 
      erros,
      errorMessages: errorDetailsList
    };

    window.dispatchEvent(new CustomEvent('sync-resultado', {
      detail: eventDetails
    }));
    return sincronizadas;
  }, [isOnline, atualizarCount]);

  // Sync ao reconectar
  useEffect(() => {
    if (wasOffline && isOnline) {
      const t = setTimeout(() => sincronizar(), 2000);
      return () => clearTimeout(t);
    }
  }, [wasOffline, isOnline, sincronizar]);

  // Sync periódico
  useEffect(() => {
    atualizarCount();
    if ((!USE_API && !isSupabaseEnabled()) || !isOnline) return;
    const interval = setInterval(sincronizar, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [sincronizar, atualizarCount, isOnline]);

  // Sync inicial
  useEffect(() => {
    if ((USE_API || isSupabaseEnabled()) && isOnline && getPesquisasPendentes().length > 0) {
      sincronizar();
    } else {
      atualizarCount();
    }
  }, []); // eslint-disable-line

  return { 
    pendentesCount, 
    isSyncing, 
    ultimoSync, 
    syncErros, 
    isOnline, 
    sincronizar, 
    atualizarCount,
    lastSyncTime: ultimoSync // Para compatibilidade com o Header/Sidebar
  };
}
