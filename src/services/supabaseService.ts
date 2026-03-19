import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { Pesquisa, Usuario, PerguntaFormulario } from '../types';

// Timeout padrão para todas as operações: 8 segundos
const withTimeout = <T>(thenable: PromiseLike<T>, ms = 8000): Promise<T> =>
  Promise.race([
    Promise.resolve(thenable),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)
    ),
  ]);

// Converte Pesquisa → linha do banco
// Mapeia {id_pergunta: resposta} → {texto_da_pergunta: resposta} para legibilidade no Supabase
const resolverRespostas = (respostas: Record<string, string>): Record<string, string> => {
  try {
    const stored = localStorage.getItem('ea_perguntas');
    const perguntas: Array<{ id: string; texto: string }> = stored ? JSON.parse(stored) : [];
    if (perguntas.length === 0) return respostas; // fallback: mantém IDs
    const mapa: Record<string, string> = {};
    for (const [id, resposta] of Object.entries(respostas)) {
      const pergunta = perguntas.find(p => p.id === id);
      mapa[pergunta ? pergunta.texto : id] = resposta;
    }
    return mapa;
  } catch {
    return respostas;
  }
};

const pesquisaToRow = (p: Pesquisa) => ({
  id:               p.id,
  timestamp:        p.timestamp,
  servidor_id:      p.servidor_id,
  servidor_nome:    p.servidor_nome,
  supervisor_id:    p.supervisor_id || null,
  morador_nome:     p.morador.nome,
  morador_telefone: p.morador.telefone,
  morador_email:    p.morador.email || null,
  morador_endereco: p.morador.endereco,
  morador_regiao:   p.morador.regiao,
  respostas:        resolverRespostas(p.respostas),
  atendimento_data: p.atendimento.data,
  atendimento_obs:  p.atendimento.observacoes || null,
  status:           'synced',
});


// Converte linha do banco → Pesquisa
const rowToPesquisa = (row: any): Pesquisa => ({
  id:            row.id,
  timestamp:     row.timestamp,
  servidor_id:   row.servidor_id,
  servidor_nome: row.servidor_nome,
  supervisor_id: row.supervisor_id || '',
  morador: {
    nome:      row.morador_nome,
    telefone:  row.morador_telefone,
    email:     row.morador_email || undefined,
    endereco:  row.morador_endereco,
    regiao:    row.morador_regiao,
  },
  respostas:   row.respostas || {},
  atendimento: {
    data:        row.atendimento_data,
    observacoes: row.atendimento_obs || undefined,
  },
  status: 'synced',
});

// ─── PESQUISAS ────────────────────────────────────────────────

export const sbUpsertPesquisa = async (pesquisa: Pesquisa): Promise<{ success: boolean; error?: string }> => {
  if (!isSupabaseEnabled() || !supabase) return { success: false, error: 'Supabase não ativado' };
  try {
    const { error } = await withTimeout(
      supabase.from('pesquisas').upsert(pesquisaToRow(pesquisa), { onConflict: 'id' })
    );
    if (error) { 
      console.error('[Supabase] upsertPesquisa:', error.message); 
      return { success: false, error: error.message }; 
    }
    return { success: true };
  } catch (e: any) {
    console.error('[Supabase] upsertPesquisa falhou:', e?.message);
    return { success: false, error: e?.message || 'Erro desconhecido' };
  }
};

export const sbGetPesquisas = async (): Promise<Pesquisa[] | null> => {
  if (!isSupabaseEnabled() || !supabase) return null;
  try {
    const { data, error } = await withTimeout(
      supabase.from('pesquisas').select('*').order('timestamp', { ascending: false })
    );
    if (error) { console.error('[Supabase] getPesquisas:', error.message); return null; }
    return (data as any[]).map(rowToPesquisa);
  } catch (e: any) {
    console.error('[Supabase] getPesquisas falhou:', e?.message);
    return null;
  }
};

export const sbDeletePesquisa = async (id: string): Promise<boolean> => {
  if (!isSupabaseEnabled() || !supabase) return false;
  try {
    const { error } = await withTimeout(
      supabase.from('pesquisas').delete().eq('id', id)
    );
    if (error) { console.error('[Supabase] deletePesquisa:', error.message); return false; }
    return true;
  } catch (e: any) {
    console.error('[Supabase] deletePesquisa falhou:', e?.message);
    return false;
  }
};

// ─── USUÁRIOS ─────────────────────────────────────────────────

export const sbGetUsuarios = async (): Promise<Usuario[] | null> => {
  if (!isSupabaseEnabled() || !supabase) return null;
  try {
    const { data, error } = await withTimeout(
      supabase.from('usuarios').select('*').order('nome')
    );
    if (error) { console.error('[Supabase] getUsuarios:', error.message); return null; }
    return data as Usuario[];
  } catch (e: any) {
    console.error('[Supabase] getUsuarios falhou:', e?.message);
    return null;
  }
};

export const sbUpsertUsuario = async (usuario: Usuario): Promise<boolean> => {
  if (!isSupabaseEnabled() || !supabase) return false;
  try {
    const { error } = await withTimeout(
      supabase.from('usuarios').upsert(usuario, { onConflict: 'id' })
    );
    if (error) { console.error('[Supabase] upsertUsuario:', error.message); return false; }
    return true;
  } catch (e: any) {
    console.error('[Supabase] upsertUsuario falhou:', e?.message);
    return false;
  }
};

export const sbSaveUsuario = sbUpsertUsuario;

export const sbToggleStatusUsuario = async (id: string, ativo: boolean): Promise<boolean> => {
  if (!isSupabaseEnabled() || !supabase) return false;
  try {
    const { error } = await withTimeout(
      supabase.from('usuarios').update({ ativo }).eq('id', id)
    );
    if (error) { console.error('[Supabase] toggleStatus:', error.message); return false; }
    return true;
  } catch (e: any) {
    console.error('[Supabase] toggleStatus falhou:', e?.message);
    return false;
  }
};

export const sbDeleteUsuario = async (id: string): Promise<boolean> => {
  if (!isSupabaseEnabled() || !supabase) return false;
  try {
    const { error } = await withTimeout(
      supabase.from('usuarios').delete().eq('id', id)
    );
    if (error) { console.error('[Supabase] deleteUsuario:', error.message); return false; }
    return true;
  } catch (e: any) {
    console.error('[Supabase] deleteUsuario falhou:', e?.message);
    return false;
  }
};

// ─── METAS ────────────────────────────────────────────────────

export const sbUpsertMeta = async (servidor_id: string, meta_semanal: number): Promise<boolean> => {
  if (!isSupabaseEnabled() || !supabase) return false;
  try {
    const { error } = await withTimeout(
      supabase.from('metas').upsert(
        { servidor_id, meta_semanal, atualizado_em: new Date().toISOString() },
        { onConflict: 'servidor_id' }
      )
    );
    if (error) { console.error('[Supabase] upsertMeta:', error.message); return false; }
    return true;
  } catch (e: any) {
    console.error('[Supabase] upsertMeta falhou:', e?.message);
    return false;
  }
};

// ─── PERGUNTAS ────────────────────────────────────────────────

export const sbGetPerguntas = async (): Promise<PerguntaFormulario[] | null> => {
  if (!isSupabaseEnabled() || !supabase) return null;
  try {
    const { data, error } = await withTimeout(
      supabase.from('perguntas').select('*').order('ordem')
    );
    if (error) { console.error('[Supabase] getPerguntas:', error.message); return null; }
    return data as PerguntaFormulario[];
  } catch (e: any) {
    console.error('[Supabase] getPerguntas falhou:', e?.message);
    return null;
  }
};

export const sbSavePerguntas = async (perguntas: PerguntaFormulario[]): Promise<boolean> => {
  if (!isSupabaseEnabled() || !supabase) return false;
  try {
    await withTimeout(supabase.from('perguntas').delete().neq('id', ''));
    const { error } = await withTimeout(supabase.from('perguntas').insert(perguntas));
    if (error) { console.error('[Supabase] savePerguntas:', error.message); return false; }
    return true;
  } catch (e: any) {
    console.error('[Supabase] savePerguntas falhou:', e?.message);
    return false;
  }
};

// ─── REGIÕES ──────────────────────────────────────────────────

export const sbGetRegioes = async (): Promise<string[] | null> => {
  if (!isSupabaseEnabled() || !supabase) return null;
  try {
    const { data, error } = await withTimeout(supabase.from('regioes').select('nome'));
    if (error) { console.error('[Supabase] getRegioes:', error.message); return null; }
    return (data as any[]).map(r => r.nome);
  } catch (e: any) {
    console.error('[Supabase] getRegioes falhou:', e?.message);
    return null;
  }
};

export const sbSaveRegioes = async (regioes: string[]): Promise<boolean> => {
  if (!isSupabaseEnabled() || !supabase) return false;
  try {
    await withTimeout(supabase.from('regioes').delete().neq('nome', ''));
    const { error } = await withTimeout(
      supabase.from('regioes').insert(regioes.map(nome => ({ nome })))
    );
    if (error) { console.error('[Supabase] saveRegioes:', error.message); return false; }
    return true;
  } catch (e: any) {
    console.error('[Supabase] saveRegioes falhou:', e?.message);
    return false;
  }
};

// ─── SYNC EM LOTE ─────────────────────────────────────────────

export const sbSyncPendentes = async (
  pendentes: Pesquisa[]
): Promise<{ ok: string[]; err: { id: string; message: string }[] }> => {
  if (!isSupabaseEnabled() || !supabase) return { ok: [], err: [] };
  const ok: string[] = [];
  const err: { id: string; message: string }[] = [];
  for (const p of pendentes) {
    const result = await sbUpsertPesquisa(p);
    if (result.success) ok.push(p.id);
    else err.push({ id: p.id, message: result.error || 'Erro desconhecido' });
  }
  return { ok, err };
};
