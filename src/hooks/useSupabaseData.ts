import { useState, useEffect, useCallback } from 'react';
import { getPesquisas, getUsuarios, getPerguntas, savePesquisa, saveUsuario, savePerguntas } from '../services/storage';
import { sbGetPesquisas, sbGetUsuarios, sbGetPerguntas, sbSavePerguntas } from '../services/supabaseService';
import { isSupabaseEnabled } from '../lib/supabase';
import { Pesquisa, Usuario } from '../types';

interface SupabaseDataState {
  pesquisas: Pesquisa[];
  usuarios: Usuario[];
  isLoading: boolean;
  error: string | null;
  fonte: 'local' | 'supabase';
  refresh: () => void;
}

export function useSupabaseData(): SupabaseDataState {
  // Inicia com localStorage IMEDIATAMENTE — zero espera, zero skeleton
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>(() => getPesquisas());
  const [usuarios, setUsuarios]   = useState<Usuario[]>(() => getUsuarios());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [fonte, setFonte]         = useState<'local' | 'supabase'>('local');

  const sincronizar = useCallback(async () => {
    if (!isSupabaseEnabled() || !navigator.onLine) return;
    try {
      const [sbPesquisas, sbUsuarios, sbPerguntas] = await Promise.all([
        sbGetPesquisas(),
        sbGetUsuarios(),
        sbGetPerguntas(),
      ]);
      if (sbPesquisas !== null) {
        sbPesquisas.forEach(p => savePesquisa(p));
        setPesquisas(sbPesquisas);
        setFonte('supabase');
        setError(null);
      }
      if (sbUsuarios !== null) {
        sbUsuarios.forEach(u => saveUsuario(u));
        setUsuarios(sbUsuarios);
      }
      // Sincronização das perguntas
      if (sbPerguntas !== null && sbPerguntas.length > 0) {
        // Supabase tem perguntas: salva localmente (fonte de verdade = Supabase)
        savePerguntas(sbPerguntas);
      } else {
        // Supabase está vazio: envia perguntas locais para popular a tabela
        const locais = getPerguntas();
        if (locais.length > 0) {
          await sbSavePerguntas(locais);
        }
      }
      if (sbPesquisas === null || sbUsuarios === null) {
        setError('Usando dados locais — banco não respondeu');
      }
    } catch (e: any) {
      setError('Erro ao conectar ao banco');
    }
  }, []);

  useEffect(() => {
    // Sincroniza em background ao montar
    sincronizar();

    // Atualiza quando uma nova pesquisa é salva localmente
    const handleNovaPesquisa = () => {
      setPesquisas(getPesquisas());
      sincronizar();
    };
    window.addEventListener('pesquisa-salva', handleNovaPesquisa);

    // Atualiza quando o sync com Supabase completa
    const handleSyncCompleto = () => sincronizar();
    window.addEventListener('sync-resultado', handleSyncCompleto);

    return () => {
      window.removeEventListener('pesquisa-salva', handleNovaPesquisa);
      window.removeEventListener('sync-resultado', handleSyncCompleto);
    };
  }, [sincronizar]);

  return { pesquisas, usuarios, isLoading, error, fonte, refresh: sincronizar };
}
