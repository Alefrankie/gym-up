/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_LANDING_URL?: string;
  readonly VITE_UPDATE_BASE_URL?: string;
}

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  // RunOnWeb checks this browser global but its published TS source omits the worker lib reference.
  const WorkerGlobalScope: unknown;
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
  }
}

export {};
