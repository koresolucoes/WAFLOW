import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// Essas variáveis devem ser configuradas no seu ambiente (ex: um arquivo .env ou variáveis de ambiente da Vercel)
// O prefixo VITE_ é crucial para que elas sejam expostas ao código do lado do navegador.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("As variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);