import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Cliente é null quando variáveis não estão configuradas (modo local puro)
export const supabase = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

export const isSupabaseEnabled = (): boolean =>
  !!(SUPABASE_URL && SUPABASE_ANON);
