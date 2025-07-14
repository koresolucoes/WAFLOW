
import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database.types';

// These should be set in Vercel environment variables.
// VITE_SUPABASE_URL is publicly available, SUPABASE_SERVICE_ROLE_KEY is secret.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // This will prevent the application from starting if the keys are not set,
  // which is a good practice for server-side environments.
  throw new Error("Supabase URL and Service Role Key are required environment variables.");
}

// Create a single, shared admin client for use in server-side functions.
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        // This configuration ensures that the client can act as an administrator
        // and is not tied to a specific user's session.
        autoRefreshToken: false,
        persistSession: false,
    },
});
