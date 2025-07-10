
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// ATENÇÃO: Estas credenciais são para fins de teste e desenvolvimento.
// Em um ambiente de produção, use variáveis de ambiente.
const supabaseUrl = 'https://mdcfnybfshkvdleundvz.supabase.co'; // Substitua pelo URL do seu projeto Supabase
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kY2ZueWJmc2hrdmRsZXVuZHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4Mzc1NDcsImV4cCI6MjA2NTQxMzU0N30.chS_bNW8mhwXLNQGXaneXGR50DrjwZVtj27e8PaT3Ig'; // Substitua pela sua chave anônima (anon key)

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
