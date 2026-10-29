// Session token storage. ADR-027 open question 3 decides the Tauri secure store;
// this web/dev fallback sits behind a small interface so the backing store can change.

const KEY = 'gymup.token';

export interface TokenStore {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

export const tokenStore: TokenStore = {
  get() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      /* storage unavailable: the session lasts for this page only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
