// SWC only compiles TypeScript; the vendored argon2 build also imports two .wasm.json files.
import { cpSync } from 'node:fs';

cpSync('src/vendor/argon2-wasm-edge/wasm', 'build/vendor/argon2-wasm-edge/wasm', { recursive: true });
