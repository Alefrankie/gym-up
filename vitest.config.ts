import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@db': fileURLToPath(new URL('./db', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Default to node (all existing tests assume Node Request/Response).
    // New UI-level tests opt in per-file with:
    //   // @vitest-environment happy-dom
    environment: 'node',
  },
});
