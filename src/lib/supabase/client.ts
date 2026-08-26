// src/lib/supabase/client.ts
//
// Supabase client init (env-driven). Story 6.2 (T6.2-01).
//
// Lazy singleton: the client is only created when a composition root
// actually needs it (STORAGE_BACKEND=supabase). The sqlite path never
// touches Supabase, so missing credentials must not break local dev.
//
// Throws a clear error if SUPABASE_URL / SUPABASE_ANON_KEY are missing
// when the client is requested (per golden-rules: Error Handling —
// never fail silently).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadDotEnvIfPresent } from '@/lib/env';

loadDotEnvIfPresent();

let client: SupabaseClient | null = null;

/**
 * Get the shared Supabase client, creating it on first use.
 * Throws if the required env vars are missing.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_ANON_KEY are required when STORAGE_BACKEND=supabase. ' +
        'Add them to .env (see .env.example).',
    );
  }

  client = createClient(url, anonKey);
  return client;
}

/**
 * Test seam: reset the cached client so tests can re-create it with a
 * different env (mirrors the `vi.resetModules()` pattern used by the
 * composition tests).
 */
export function __resetSupabaseClientForTesting(): void {
  client = null;
}