<script lang="ts">
  import { goto } from '$app/navigation';
  import { sessionResponseSchema, type LoginRequest } from '@gym-up/contracts';
  import { api, ApiRequestError } from '#lib/api/client';
  import { tokenStore } from '#lib/api/token';
  import { session } from '#lib/session';

  let email = $state('');
  let password = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    busy = true;
    try {
      const body: LoginRequest = { email, password };
      const res = await api('/auth/login', { body, schema: sessionResponseSchema });
      tokenStore.set(res.token);
      await session.set(res.user);
      await goto('/dashboard', { replaceState: true });
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'No se pudo conectar con el servidor';
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <h1>Gym Up</h1>
  <form onsubmit={submit}>
    <label>Email<input type="email" bind:value={email} autocomplete="email" required /></label>
    <label>
      Contraseña
      <input type="password" bind:value={password} autocomplete="current-password" required />
    </label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="primary" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
  </form>
  <p class="muted">¿Primera vez? <a href="/register">Crear cuenta</a></p>
</main>
