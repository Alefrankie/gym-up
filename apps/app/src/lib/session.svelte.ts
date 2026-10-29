import { goto } from '$app/navigation';
import { userSchema, type UserDto } from '@gym-up/contracts';
import { api, ApiRequestError } from '#lib/api/client';
import { tokenStore } from '#lib/api/token';

/** Current user, loaded once per app start. `undefined` while loading, `null` when signed out. */
class Session {
  user = $state<UserDto | null | undefined>(undefined);

  /** Loads the user for the stored token; sends the user to /login when there is none. */
  async require(): Promise<UserDto | null> {
    if (this.user) return this.user;
    if (!tokenStore.get()) {
      this.user = null;
      await goto('/login', { replaceState: true });
      return null;
    }
    try {
      this.user = await api('/auth/me', { schema: userSchema });
      return this.user;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        this.user = null;
        await goto('/login', { replaceState: true });
        return null;
      }
      throw e;
    }
  }

  async signOut(): Promise<void> {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* the token is discarded locally either way */
    }
    tokenStore.clear();
    this.user = null;
    await goto('/login', { replaceState: true });
  }
}

export const session = new Session();
