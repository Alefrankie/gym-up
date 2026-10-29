import { goto } from '$app/navigation';
import { userSchema, type UserDto } from '@gym-up/contracts';
import { api, ApiRequestError, NetworkError } from '#lib/api/client';
import { cachedGet, clearCache } from '#lib/offline/cache';
import { kv } from '#lib/offline/idb';
import { clearAllSessions } from '#lib/offline/workout-session';
import { sync } from '#lib/offline/sync.svelte';
import { tokenStore } from '#lib/api/token';

/** Current user, loaded once per app start. `undefined` while loading, `null` when signed out. */
class Session {
  user = $state<UserDto | null | undefined>(undefined);

  /** After login or register: remember the user, and cache it so the app also opens with no signal. */
  async set(user: UserDto): Promise<void> {
    this.user = user;
    await kv.set('cache:/auth/me', { data: user, at: Date.now() });
  }

  /** Loads the user for the stored token; sends the user to /login when there is none. */
  async require(): Promise<UserDto | null> {
    if (this.user) return this.user;
    if (!tokenStore.get()) {
      this.user = null;
      await goto('/login', { replaceState: true });
      return null;
    }
    try {
      // The cached user keeps the app usable with no signal; a 401 still sends the user to /login.
      this.user = (await cachedGet('/auth/me', userSchema)).data;
      return this.user;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        this.user = null;
        await goto('/login', { replaceState: true });
        return null;
      }
      if (e instanceof NetworkError) {
        // No signal and nothing cached yet (first launch offline): there is no user to show.
        this.user = null;
        await goto('/login', { replaceState: true });
        return null;
      }
      throw e;
    }
  }

  async signOut(): Promise<void> {
    if (sync.pending > 0 && !confirm(`Tienes ${sync.pending} cambios sin enviar. Si sales ahora se perderán. ¿Salir de todos modos?`)) {
      return;
    }
    try {
      await api('/auth/logout', { method: 'POST', timeoutMs: 4000 });
    } catch {
      /* the token is discarded locally either way */
    }
    tokenStore.clear();
    await clearCache();
    await clearAllSessions();
    await sync.outbox.discardAll();
    await sync.refresh();
    this.user = null;
    await goto('/login', { replaceState: true });
  }
}

export const session = new Session();
