// src/lib/contexts/auth/argon2-password-hasher.ts
//
// Password hashing with argon2id compiled to WASM (ADR-027 section 7).
//
// Parameters are the OWASP minimum: m=19456 KiB, t=2, p=1. The hash is stored
// as a PHC string ($argon2id$v=19$m=19456,t=2,p=1$...).
//
// In Node (tests, local scripts) this uses the stock `argon2-wasm-edge`
// package. In the Cloudflare Worker the Nest provider swaps it for the
// shared-instance build (one WASM instance, memory zeroed per run), because
// the stock library exhausts the 128 MB isolate limit after a few hashes.

import { argon2id, argon2Verify } from 'argon2-wasm-edge';
import type { PasswordHasher } from './auth.types';

export const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 2,
  memorySize: 19456, // KiB
  hashLength: 32,
} as const;

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return argon2id({
      ...ARGON2_PARAMS,
      password,
      salt,
      outputType: 'encoded',
    });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return argon2Verify({ password, hash });
  }
}
