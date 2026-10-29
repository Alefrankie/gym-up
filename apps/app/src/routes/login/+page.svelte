<script lang="ts">
  import { goto } from '$app/navigation';
  import { sessionResponseSchema, type LoginRequest } from '@gym-up/contracts';
  import { api, ApiRequestError } from '#lib/api/client';
  import { tokenStore } from '#lib/api/token';
  import { session } from '#lib/session';
  import AuthShell from '#lib/components/AuthShell.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import PasswordField from '#lib/components/PasswordField.svelte';

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
      error = e instanceof ApiRequestError ? e.message : 'No hay conexión con el servidor. Revisa tu señal e inténtalo otra vez.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Entrar · Gym Up</title></svelte:head>

<AuthShell title="Entrar" lead="Tu rutina de hoy te está esperando.">
  <form id="auth" onsubmit={submit}>
    <label>
      Email
      <input type="email" bind:value={email} autocomplete="email" inputmode="email" required />
    </label>
    <PasswordField bind:value={password} label="Contraseña" autocomplete="current-password" />
    {#if error}<p class="error" role="alert"><Icon name="alert" size={20} /> {error}</p>{/if}
  </form>

  {#snippet actions()}
    <button class="primary" type="submit" form="auth" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
    <p class="alt">¿Primera vez? <a href="/register">Crear cuenta</a></p>
  {/snippet}
</AuthShell>

<style>
  form {
    gap: 1.1rem;
  }
  .error {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    margin: 0;
  }
  .error :global(svg) {
    flex: none;
    margin-top: 0.1rem;
  }
</style>
