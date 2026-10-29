<script lang="ts">
  import { goto } from '$app/navigation';
  import { sessionResponseSchema, type LoginRequest } from '@gym-up/contracts';
  import { api, ApiRequestError } from '#lib/api/client';
  import { tokenStore } from '#lib/api/token';

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
      const session = await api('/auth/login', { body, schema: sessionResponseSchema });
      tokenStore.set(session.token);
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
    <label>
      Email
      <input type="email" bind:value={email} autocomplete="email" required />
    </label>
    <label>
      Contraseña
      <input type="password" bind:value={password} autocomplete="current-password" required />
    </label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
  </form>
</main>

<style>
  form {
    display: grid;
    gap: 1rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    color: var(--muted);
  }
  input {
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #334155;
    background: var(--surface);
    color: var(--text);
  }
  button {
    padding: 0.75rem;
    border: 0;
    border-radius: 0.5rem;
    background: var(--accent);
    color: #052e16;
    font-weight: 600;
  }
  .error {
    color: var(--danger);
    margin: 0;
  }
</style>
