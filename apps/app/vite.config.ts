import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// `TAURI_DEV_HOST` is set by `tauri android dev` so a physical device can reach the dev server.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // SvelteKit 3 takes its options here (svelte.config.js is no longer supported).
  // Static SPA (ADR-027): no SSR; the same build is the web app and the Tauri webview content.
  plugins: [sveltekit({ adapter: adapter({ fallback: 'index.html' }) })],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 5174 } : undefined,
  },
});
