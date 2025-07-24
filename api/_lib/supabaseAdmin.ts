
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types.js';

// These should be set in Vercel environment variables.
// The backend function needs access to the URL and the secret service role key.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // This will prevent the application from starting if the keys are not set,
  // which is a good practice for server-side environments.
  throw new Error("Supabase URL (SUPABASE_URL or VITE_SUPABASE_URL) and Service Role Key (SUPABASE_SERVICE_ROLE_KEY) are required environment variables.");
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
