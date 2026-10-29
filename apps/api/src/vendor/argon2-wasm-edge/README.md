# argon2-wasm-edge (vendored, patched)

Source: https://www.npmjs.com/package/argon2-wasm-edge, version 1.0.23, MIT license (see `LICENSE`).

## Why it is vendored

ADR-027 section 7. The stock library creates a new WASM instance, with a new linear memory of `m` KiB,
on every hash. On a Cloudflare Worker (128 MB isolate limit) that fails with `503 Worker exceeded
resource limits` after about five hashes at the OWASP minimum (19 MiB).

## The patch (`lib/argon2.ts`, search for `PATCH`)

1. One shared argon2 WASM instance for the lifetime of the isolate.
2. Runs are serialized with a mutex (the instance has one memory).
3. The instance memory is zeroed before every run. Without this a reused instance returns **wrong
   hashes** (verified: 5 of 6 parameter sets differed before the fix, 6 of 6 matched after).

`tests/auth/vendored-argon2.test.ts` checks equivalence with the stock package.

## Updating

Diff against the new upstream version, reapply the patch, and rerun the equivalence test and the
deployed 40-hash check described in ADR-027.
