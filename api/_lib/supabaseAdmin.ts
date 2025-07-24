
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types.js';

// Enhanced logging for debugging environment variables in the Vercel runtime.
console.log('[Supabase Admin] Initializing...');
console.log(`[Supabase Admin] Has SUPABASE_URL: ${!!process.env.SUPABASE_URL}`);
console.log(`[Supabase Admin] Has VITE_SUPABASE_URL: ${!!process.env.VITE_SUPABASE_URL}`);
console.log(`[Supabase Admin] Has SUPABASE_SERVICE_ROLE_KEY: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);


// These should be set in Vercel environment variables.
// The backend function needs access to the URL and the secret service role key.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// A more robust check to ensure variables are not just present but also not empty.
if (!supabaseUrl || supabaseUrl.trim() === '' || !supabaseServiceKey || supabaseServiceKey.trim() === '') {
  const errorMessage = "Supabase URL (SUPABASE_URL or VITE_SUPABASE_URL) and Service Role Key (SUPABASE_SERVICE_ROLE_KEY) are required and cannot be empty.";
  console.error(`[Supabase Admin] FATAL ERROR: ${errorMessage}`);
  console.error(`[Supabase Admin] Received URL: '${supabaseUrl}'`);
  // This will cause the function to fail loudly if keys are not set correctly.
  throw new Error(errorMessage);
}

console.log('[Supabase Admin] Credentials seem valid. Creating client.');

// Create a single, shared admin client for use in server-side functions.
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        // This configuration ensures that the client can act as an administrator
        // and is not tied to a specific user's session.
        autoRefreshToken: false,
        persistSession: false,
    },
});

console.log('[Supabase Admin] Client created successfully.');