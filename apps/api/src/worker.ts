// Cloudflare Worker entry point (ADR-027).
//
// Nest runs on the Express adapter inside the Worker through `httpServerHandler`
// (nodejs_compat). The app boots lazily on the first request, then stays warm in the isolate.
// The build is `swc` (decorator metadata) then Wrangler bundling; see package.json "build:worker".

import 'reflect-metadata';
import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@db/schema';
// WASM modules are imported as precompiled modules; Workers cannot compile WASM from bytes.
import argon2WASM from 'argon2-wasm-edge/wasm/argon2.wasm';
import blake2bWASM from 'argon2-wasm-edge/wasm/blake2b.wasm';
import type { Db } from '@/lib/db/client';
import { R2PhotoStorage, type R2BucketLike } from '@/lib/contexts/private-photos/infrastructure/r2-photo-storage';
import { GeminiVisionAdapter } from '@/lib/contexts/nutrition/infrastructure/ai/gemini-vision.adapter';
import { createApp } from './nest/create-app';
import type { RateLimiter } from './nest/tokens';
import { registerArgon2Wasm, SharedInstanceArgon2PasswordHasher } from './worker/shared-argon2-hasher';

interface WorkerEnv {
  DB: unknown;
  /** Optional Cloudflare Rate Limiting binding (see wrangler.jsonc). */
  LOGIN_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** Optional R2 bucket for private photos (see wrangler.jsonc). Without it the photo endpoints answer 503. */
  PHOTOS?: R2BucketLike;
  /** Optional Gemini API key (a Worker secret). Without it /nutrition/analyze answers 503. */
  GEMINI_API_KEY?: string;
  /** Comma separated extra CORS origins (for example a preview web build). */
  EXTRA_ORIGINS?: string;
}

registerArgon2Wasm({ argon2WASM, blake2bWASM });

let ready: Promise<ReturnType<typeof httpServerHandler>> | null = null;

async function boot() {
  const e = env as unknown as WorkerEnv;
  const rateLimiter: RateLimiter | undefined = e.LOGIN_LIMITER
    ? { allow: async (key) => (await e.LOGIN_LIMITER!.limit({ key })).success }
    : undefined;

  const { express } = await createApp(
    {
      db: drizzle(e.DB as never, { schema }) as unknown as Db,
      hasher: new SharedInstanceArgon2PasswordHasher(),
      rateLimiter,
      photoStorage: e.PHOTOS ? new R2PhotoStorage(e.PHOTOS) : undefined,
      aiAnalysis: e.GEMINI_API_KEY ? new GeminiVisionAdapter(e.GEMINI_API_KEY) : undefined,
    },
    (e.EXTRA_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  );
  express.listen(3000);
  return httpServerHandler({ port: 3000 });
}

export default {
  async fetch(request: Request, workerEnv: unknown, ctx: unknown): Promise<Response> {
    try {
      ready ??= boot();
      const handler = (await ready) as unknown as {
        fetch(r: Request, e: unknown, c: unknown): Promise<Response>;
      };
      return await handler.fetch(request, workerEnv, ctx);
    } catch (err) {
      // A failed boot must not poison the isolate: the next request retries.
      ready = null;
      console.error('boot failed', err);
      return Response.json({ statusCode: 500, message: 'Internal server error' }, { status: 500 });
    }
  },
};
