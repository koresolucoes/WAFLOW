import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';

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

console.log('[Supabase Admin] Credentials seem valid. Creating client with a custom fetch timeout and retry logic.');

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
 * A wrapper around the global fetch that adds a timeout and retry logic.
 * This is crucial in serverless environments to prevent functions from hanging
 * on stalled network requests, especially when dealing with "waking up" a free-tier database.
 * @param url The request URL.
 * @param options The request options.
 * @param timeout The timeout in milliseconds for each attempt.
 * @param retries The total number of attempts to make.
 * @returns A fetch Response promise.
 */
const fetchWithTimeoutAndRetries = async (
    url: RequestInfo | URL,
    options: RequestInit = {},
    timeout = 25000, // 25 seconds
    retries = 3
): Promise<Response> => {
    const urlForLogging = getUrlStringForLogging(url);
    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const { signal } = controller;

        const timeoutId = setTimeout(() => {
            console.warn(`[Supabase Admin] Fetch attempt ${attempt} timed out after ${timeout}ms for URL: ${urlForLogging}`);
            controller.abort('Timeout');
        }, timeout);

        try {
            const response = await fetch(url, { ...options, signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (attempt === retries) {
                console.error(`[Supabase Admin] Fetch failed on final attempt (${attempt}) for URL ${urlForLogging}:`, error);
                throw error;
            }
            console.warn(`[Supabase Admin] Fetch attempt ${attempt} failed for ${urlForLogging}. Retrying in ${attempt}s...`, error.message);
            // Simple exponential backoff
            await new Promise(res => setTimeout(res, 1000 * attempt));
        }
    }
    // This line should be unreachable if retries > 0, but is required for TypeScript's control flow analysis.
    throw new Error('Fetch failed after all retries. This should not be reached.');
};


// Create a single, shared admin client for use in server-side functions.
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    // Add the timeout and retry logic to all fetch requests made by the Supabase client.
    global: {
        fetch: (url, options) => fetchWithTimeoutAndRetries(url, options)
    }
});

console.log('[Supabase Admin] Client created successfully with retry logic.');