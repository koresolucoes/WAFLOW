
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// Lê as credenciais do Supabase a partir das variáveis de ambiente do Vite.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("As variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);