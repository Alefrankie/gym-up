// src/lib/env.ts
//
// Best-effort .env loader shared by infrastructure clients that read
// `process.env` (Supabase client, etc.). Astro/Vite normally injects
// env vars via `import.meta.env`, but the codebase reads from
// `process.env` so the same client works in tests, the Astro SSR
// runtime, and Vercel functions without per-environment branching.
//
// Note: `src/lib/db/client.ts` has its own inline copy of this loader
// (legacy, pre-dates this module). Kept separate to avoid touching
// working code; a future cleanup can consolidate both onto this helper.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

/**
 * Load `.env` into `process.env` once. Idempotent — safe to call from
 * multiple modules. Never overwrites an already-set variable.
 */
export function loadDotEnvIfPresent(): void {
  if (loaded) return;
  loaded = true;

  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const text = readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}