
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types.js';

// Enhanced logging for debugging environment variables in the Vercel runtime.
console.log('[Supabase Admin] Initializing...');
console.log(`[Supabase Admin] Has SUPABASE_URL: ${!!process.env.SUPABASE_URL}`);
console.log(`[Supabase Admin] Has VITE_SUPABASE_URL: ${!!process.env.VITE_SUPABASE_URL}`);
console.log(`[Supabase Admin] Has SUPABASE_SERVICE_ROLE_KEY: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);

// These should be set in Vercel environment variables.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || supabaseUrl.trim() === '' || !supabaseServiceKey || supabaseServiceKey.trim() === '') {
  const errorMessage = "Supabase URL (SUPABASE_URL or VITE_SUPABASE_URL) and Service Role Key (SUPABASE_SERVICE_ROLE_KEY) are required and cannot be empty.";
  console.error(`[Supabase Admin] FATAL ERROR: ${errorMessage}`);
  console.error(`[Supabase Admin] Received URL: '${supabaseUrl}'`);
  throw new Error(errorMessage);
}

console.log('[Supabase Admin] Credentials seem valid. Creating client with custom fetch timeout.');

/**
 * A wrapper around the global fetch that adds a timeout.
 * This is crucial in serverless environments to prevent functions from hanging
 * on stalled network requests.
 * @param url The request URL.
 * @param options The request options.
 * @param timeout The timeout in milliseconds.
 * @returns A fetch Response promise.
 */
const fetchWithTimeout = (url: RequestInfo, options: RequestInit = {}, timeout = 8000) => {
    const controller = new AbortController();
    const { signal } = controller;
    const timeoutId = setTimeout(() => {
        console.error(`[Supabase Admin] Fetch timeout reached after ${timeout}ms for URL: ${url}`);
        controller.abort();
    }, timeout);

    return fetch(url, { ...options, signal })
        .finally(() => clearTimeout(timeoutId));
};

// Create a single, shared admin client for use in server-side functions.
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    // Add the timeout to all fetch requests made by the Supabase client.
    global: {
        fetch: (url, options) => fetchWithTimeout(url, options, 8000) // 8-second timeout
    }
});

console.log('[Supabase Admin] Client created successfully.');
