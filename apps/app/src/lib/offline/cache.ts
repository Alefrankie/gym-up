import type { ZodType } from 'zod';
import { api } from '../api/client';
import { NetworkError } from '../api/errors';
import { kv } from './idb';

interface CacheEntry {
  data: unknown;
  at: number;
}

export interface Cached<T> {
  data: T;
  /** True when the network failed and this is the last copy we saw. */
  stale: boolean;
  /** Epoch ms when the data was fetched from the server. */
  fetchedAt: number;
}

const key = (path: string) => `cache:${path}`;

/**
 * Read-through cache for GET endpoints (ADR-027 section 5, replacing the service worker): the network first,
 * the last good response when there is no signal. Reads are validated again with the contract on the way out.
 */
export async function cachedGet<T>(path: string, schema: ZodType<T>): Promise<Cached<T>> {
  try {
    const data = await api(path, { schema });
    const at = Date.now();
    await kv.set(key(path), { data, at } satisfies CacheEntry);
    return { data, stale: false, fetchedAt: at };
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    const hit = await kv.get<CacheEntry>(key(path));
    if (!hit) throw e;
    const parsed = schema.safeParse(hit.data);
    if (!parsed.success) throw e;
    return { data: parsed.data, stale: true, fetchedAt: hit.at };
  }
}

/** Drops cached reads so the next load refetches (after a sync changed server data). */
export async function invalidateCache(prefixes: string[]): Promise<void> {
  for (const p of prefixes) for (const k of await kv.keys(key(p))) await kv.delete(k);
}

export async function clearCache(): Promise<void> {
  for (const k of await kv.keys('cache:')) await kv.delete(k);
}
