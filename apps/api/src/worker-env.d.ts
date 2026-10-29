// Ambient types for Cloudflare-only modules. `@cloudflare/workers-types` is not used in the
// tsconfig because its globals collide with the Node types that the tests need.

declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}

declare module 'cloudflare:node' {
  export function httpServerHandler(options: { port: number }): {
    fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  };
}

declare module '*.wasm' {
  const module: WebAssembly.Module;
  export default module;
}
