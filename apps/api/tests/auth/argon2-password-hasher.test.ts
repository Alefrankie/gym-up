// tests/auth/argon2-password-hasher.test.ts
//
// ADR-027 section 7: argon2id WASM with the OWASP minimum parameters, PHC-encoded.

import { describe, it, expect } from 'vitest';
import { Argon2PasswordHasher, ARGON2_PARAMS } from '../../src/lib/contexts/auth/argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('encodes argon2id with the OWASP minimum parameters', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    expect(hash.startsWith(`$argon2id$v=19$m=${ARGON2_PARAMS.memorySize},t=${ARGON2_PARAMS.iterations},p=${ARGON2_PARAMS.parallelism}$`)).toBe(true);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hasher.hash('s3cret-passphrase');
    expect(await hasher.verify('s3cret-passphrase', hash)).toBe(true);
    expect(await hasher.verify('another-passphrase', hash)).toBe(false);
  });

  it('uses a different salt every time', async () => {
    const a = await hasher.hash('same-password');
    const b = await hasher.hash('same-password');
    expect(a).not.toBe(b);
  });
});
