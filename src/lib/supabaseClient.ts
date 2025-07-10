
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// Lê as credenciais do Supabase a partir das variáveis de ambiente do Vite.
// Vite expõe variáveis do lado do cliente em `import.meta.env` em vez de `process.env`.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("As variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. Verifique a configuração no painel da Vercel e faça um novo deploy.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);