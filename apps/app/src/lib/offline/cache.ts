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

/** Copy of every read seen in this session, so a revisited screen can paint in the same frame it mounts. */
const memory = new Map<string, CacheEntry>();

/**
 * Read-through cache for GET endpoints (ADR-027 section 5, replacing the service worker): the network first,
 * the last good response when there is no signal. Reads are validated again with the contract on the way out.
 */
export async function cachedGet<T>(
  path: string,
  schema: ZodType<T>,
  opts: { onCached?: (hit: Cached<T>) => void } = {},
): Promise<Cached<T>> {
  // Stale-while-revalidate: a saved copy is handed over at once so the screen never waits on the network.
  if (opts.onCached) {
    const seen = memory.get(path);
    const hit = seen ?? (await kv.get<CacheEntry>(key(path)));
    const parsed = hit ? schema.safeParse(hit.data) : null;
    if (hit && parsed?.success) opts.onCached({ data: parsed.data, stale: false, fetchedAt: hit.at });
  }
  try {
    const data = await api(path, { schema });
    const at = Date.now();
    memory.set(path, { data, at });
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

/** Rewrites a cached read in place (e.g. after a local change that the server has not confirmed yet). */
export async function updateCached<T>(path: string, change: (data: T) => T): Promise<void> {
  const hit = memory.get(path) ?? (await kv.get<CacheEntry>(key(path)));
  if (hit) memory.set(path, { ...hit, data: change(hit.data as T) });
  if (hit) await kv.set(key(path), { ...hit, data: change(hit.data as T) } satisfies CacheEntry);
}

/** Drops cached reads so the next load refetches (after a sync changed server data). */
export async function invalidateCache(prefixes: string[]): Promise<void> {
  for (const p of prefixes) {
    for (const k of memory.keys()) if (k.startsWith(p)) memory.delete(k);
    for (const k of await kv.keys(key(p))) await kv.delete(k);
  }
}

export async function clearCache(): Promise<void> {
  memory.clear();
  for (const k of await kv.keys('cache:')) await kv.delete(k);
}
