import { Pesquisa } from '../types';
import { markAsSynced } from './storage';
import { sbUpsertPesquisa } from './supabaseService';
import { isSupabaseEnabled } from '../lib/supabase';

const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL || '';
const USE_API     = import.meta.env.VITE_USE_API === 'true';

export const pesquisaService = {
  submit: async (pesquisa: Pesquisa): Promise<void> => {
    if (!navigator.onLine) return;
    if (isSupabaseEnabled()) {
      try { 
        const ok = await sbUpsertPesquisa(pesquisa);
        if (ok) markAsSynced(pesquisa.id);
      } catch { /* fica pending_sync, será reenviado */ }
      return;
    }
    if (USE_API && WEBHOOK_URL) {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 8000);
        const response = await window.fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evento: 'nova_pesquisa', pesquisa }),
          signal: controller.signal,
        });
        if (response.ok) markAsSynced(pesquisa.id);
      } catch { /* fica pending_sync */ }
    }
  },
};

