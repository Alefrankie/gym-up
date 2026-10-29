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
  <header class="brand">
    <svg class="mark" viewBox="0 0 48 48" width="56" height="56" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 26v-8M11 29V15M37 29V15M42 26v-8M11 22h26"/><path d="M24 40V28M19 33l5-5 5 5"/></svg>
    <h1>Gym Up</h1>
    <p>Entrena, registra, sube de nivel.</p>
  </header>
  <section class="card hero">
    <form onsubmit={submit}>
      <label>Email<input type="email" bind:value={email} autocomplete="email" required /></label>
      <label>
        Contraseña
        <input type="password" bind:value={password} autocomplete="current-password" required />
      </label>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button class="primary" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  </section>
  <p class="muted alt">¿Primera vez? <a href="/register">Crear cuenta</a></p>
</main>

<style>
  .brand {
    display: grid;
    justify-items: center;
    gap: 0.25rem;
    text-align: center;
    padding-top: 2.5rem;
    margin-bottom: 1.5rem;
  }
  .mark {
    color: var(--accent);
    filter: drop-shadow(0 6px 14px rgb(255 106 43 / 0.45));
  }
  .brand h1 {
    margin: 0.4rem 0 0;
    font-size: 3.6rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .brand p {
    margin: 0;
    color: var(--muted);
  }
  .card form {
    gap: 1rem;
  }
  .alt {
    text-align: center;
    margin-top: 0.5rem;
  }
</style>
