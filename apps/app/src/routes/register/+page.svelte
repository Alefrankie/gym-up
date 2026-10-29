<script lang="ts">
  import { goto } from '$app/navigation';
  import { sessionResponseSchema } from '@gym-up/contracts';
  import { api, ApiRequestError } from '#lib/api/client';
  import { tokenStore } from '#lib/api/token';
  import { session } from '#lib/session';
  import AuthShell from '#lib/components/AuthShell.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import PasswordField from '#lib/components/PasswordField.svelte';

  let email = $state('');
  let password = $state('');
  let displayName = $state('');
  let routineType = $state<'hombre' | 'mujer'>('hombre');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    busy = true;
    try {
      const body = { email, password, displayName, routineType };
      const res = await api('/auth/register', { body, schema: sessionResponseSchema });
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

<svelte:head><title>Crear cuenta · Gym Up</title></svelte:head>

<AuthShell title="Crear cuenta" lead="Elige tu plan inicial y registra tu primera serie hoy.">
  <form id="auth" onsubmit={submit}>
    <label>
      Nombre
      <input bind:value={displayName} autocomplete="name" required />
    </label>
    <label>
      Email
      <input type="email" bind:value={email} autocomplete="email" inputmode="email" required />
    </label>
    <PasswordField bind:value={password} label="Contraseña (mínimo 8 caracteres)" autocomplete="new-password" minlength={8} />
    <fieldset>
      <legend>Plan inicial</legend>
      <div class="seg">
        <label class:on={routineType === 'hombre'}>
          <input type="radio" name="routine" value="hombre" bind:group={routineType} /> Hombre
        </label>
        <label class:on={routineType === 'mujer'}>
          <input type="radio" name="routine" value="mujer" bind:group={routineType} /> Mujer
        </label>
      </div>
    </fieldset>
    {#if error}<p class="error" role="alert"><Icon name="alert" size={20} /> {error}</p>{/if}
  </form>

  {#snippet actions()}
    <button class="primary" type="submit" form="auth" disabled={busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
    <p class="alt">¿Ya tienes cuenta? <a href="/login">Entrar</a></p>
  {/snippet}
</AuthShell>

<style>
  form {
    gap: 1.1rem;
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    margin-bottom: 0.35rem;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: 12px;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .seg label {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 36px;
    border-radius: 6px;
    color: var(--muted);
    font-weight: 550;
    font-size: var(--t-base);
    cursor: pointer;
    transition: background 160ms, color 160ms;
  }
  .seg label.on {
    background: var(--raised);
    color: var(--text);
  }
  .seg input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .seg label:has(input:focus-visible) {
    outline: 2px solid var(--ember);
    outline-offset: 2px;
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
