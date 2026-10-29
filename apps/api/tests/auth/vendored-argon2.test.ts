// tests/auth/vendored-argon2.test.ts
//
// ADR-027 section 7: the vendored build that shares one WASM instance must return exactly the same
// hashes as the stock package, across parameter sets, repeated runs and changing memory sizes.
// A reused instance without zeroing its memory returned wrong hashes, so this guards the patch.

import { describe, it, expect } from 'vitest';
import { argon2id as stock } from 'argon2-wasm-edge';
import { argon2id as shared, argon2Verify as sharedVerify } from '../../src/vendor/argon2-wasm-edge/lib/argon2';

const salt = new Uint8Array(16).map((_, i) => i + 1);

describe('vendored argon2 (shared WASM instance)', () => {
  it('matches the stock package for several parameter sets, in sequence', async () => {
    const cases: Array<[number, number, number]> = [
      [1024, 1, 1],
      [19456, 2, 1],
      [8192, 3, 2],
      [19456, 2, 1],
      [4096, 2, 4],
      [1024, 1, 1],
    ];
    for (const [memorySize, iterations, parallelism] of cases) {
      const opts = { password: 'secret', salt, parallelism, iterations, memorySize, hashLength: 32, outputType: 'encoded' as const };
      expect(await shared({ ...opts }), `m=${memorySize} t=${iterations} p=${parallelism}`).toBe(await stock({ ...opts }));
    }
  });

  it('serializes concurrent runs without corrupting the shared memory', async () => {
    const opts = { password: 'secret', salt, parallelism: 1, iterations: 2, memorySize: 4096, hashLength: 32, outputType: 'encoded' as const };
    const expected = await stock({ ...opts });
    const results = await Promise.all(Array.from({ length: 6 }, () => shared({ ...opts })));
    for (const r of results) expect(r).toBe(expected);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await shared({ password: 'right', salt, parallelism: 1, iterations: 2, memorySize: 4096, hashLength: 32, outputType: 'encoded' });
    expect(await sharedVerify({ password: 'right', hash: hash as string })).toBe(true);
    expect(await sharedVerify({ password: 'wrong', hash: hash as string })).toBe(false);
  });
});
