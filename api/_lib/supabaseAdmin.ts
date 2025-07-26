
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

console.log('[Supabase Admin] Credentials seem valid. Creating client with a custom fetch timeout.');

const getUrlStringForLogging = (url: RequestInfo | URL): string => {
    if (typeof url === 'string') {
        return url;
    }
    if (url instanceof URL) {
        return url.href;
    }
    // It's a Request object
    return url.url;
};

/**
 * A wrapper around the global fetch that adds a reasonable timeout.
 * This is crucial in serverless environments to prevent functions from hanging
 * on stalled network requests, especially when dealing with "waking up" a free-tier database.
 * The 15-second timeout is generous for a cold start but well within Vercel's execution limits.
 * @param url The request URL.
 * @param options The request options.
 * @returns A fetch Response promise.
 */
const fetchWithTimeout = async (
    url: RequestInfo | URL,
    options: RequestInit = {},
    timeout = 15000 // 15 seconds
): Promise<Response> => {
    const controller = new AbortController();
    const { signal } = controller;
    
    const urlForLogging = getUrlStringForLogging(url);

    const timeoutId = setTimeout(() => {
        console.warn(`[Supabase Admin] Fetch timeout reached after ${timeout}ms for URL: ${urlForLogging}`);
        controller.abort('Timeout'); // Pass a reason for better debugging
    }, timeout);

    try {
        const response = await fetch(url, { ...options, signal });
        clearTimeout(timeoutId); // Important: clear the timeout if fetch succeeds
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId); // Clear timeout on error too
        console.error(`[Supabase Admin] Fetch failed for URL ${urlForLogging}:`, error);
        throw error;
    }
};


// Create a single, shared admin client for use in server-side functions.
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    // Add the timeout logic to all fetch requests made by the Supabase client.
    global: {
        fetch: (url, options) => fetchWithTimeout(url, options)
    }
});

console.log('[Supabase Admin] Client created successfully.');
