<script lang="ts">
  import { t } from '#lib/i18n';
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
      error = e instanceof ApiRequestError ? e.message : t('auth.noServer');
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t('auth.login')} · Gym Up</title></svelte:head>

<AuthShell title={t('auth.login')} lead={t('auth.loginLead')}>
  <form id="auth" onsubmit={submit}>
    <label>
      {t('auth.email')}
      <input type="email" bind:value={email} autocomplete="email" inputmode="email" required />
    </label>
    <PasswordField bind:value={password} label={t('auth.password')} autocomplete="current-password" />
    {#if error}<p class="error" role="alert"><Icon name="alert" size={20} /> {error}</p>{/if}
  </form>

  {#snippet actions()}
    <button class="primary" type="submit" form="auth" disabled={busy}>{busy ? t('auth.loggingIn') : t('auth.login')}</button>
    <p class="alt">{t('auth.firstTime')} <a href="/register">{t('auth.register')}</a></p>
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
