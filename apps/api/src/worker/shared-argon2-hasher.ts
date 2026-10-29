// Password hasher for the Cloudflare Worker (ADR-027 section 7).
//
// Same algorithm and parameters as `Argon2PasswordHasher` (argon2id, OWASP minimum, PHC string),
// but through the vendored build that shares one WASM instance. The WASM modules must be
// registered once from the entry point because Workers cannot compile WASM from bytes.

import { argon2id, argon2Verify, setWASMModules } from '../vendor/argon2-wasm-edge/lib/argon2';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { ARGON2_PARAMS } from '@/lib/contexts/auth/argon2-password-hasher';

export function registerArgon2Wasm(modules: { argon2WASM: WebAssembly.Module; blake2bWASM: WebAssembly.Module }): void {
  setWASMModules(modules);
}

export class SharedInstanceArgon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return argon2id({ ...ARGON2_PARAMS, password, salt, outputType: 'encoded' }) as Promise<string>;
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return argon2Verify({ password, hash });
  }
}
