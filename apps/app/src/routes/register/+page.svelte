<script lang="ts">
  import { goto } from '$app/navigation';
  import { sessionResponseSchema, type RegisterRequest } from '@gym-up/contracts';
  import { api, ApiRequestError } from '#lib/api/client';
  import { tokenStore } from '#lib/api/token';
  import { session } from '#lib/session';

  let email = $state('');
  let password = $state('');
  let displayName = $state('');
  let routineType = $state<'hombre' | 'mujer'>('hombre');
  let weightUnit = $state<'kg' | 'lbs'>('kg');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    busy = true;
    try {
      const body: RegisterRequest = { email, password, displayName, routineType, weightUnit };
      const res = await api('/auth/register', { body, schema: sessionResponseSchema });
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
  <h1>Crear cuenta</h1>
  <form onsubmit={submit}>
    <label>Nombre<input bind:value={displayName} autocomplete="name" required /></label>
    <label>Email<input type="email" bind:value={email} autocomplete="email" required /></label>
    <label>
      Contraseña (mínimo 8)
      <input type="password" bind:value={password} autocomplete="new-password" minlength="8" required />
    </label>
    <label>
      Rutina
      <select bind:value={routineType}>
        <option value="hombre">Hombre</option>
        <option value="mujer">Mujer</option>
      </select>
    </label>
    <label>
      Unidad de peso
      <select bind:value={weightUnit}>
        <option value="kg">kg</option>
        <option value="lbs">lbs</option>
      </select>
    </label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="primary" type="submit" disabled={busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
  </form>
  <p class="muted">¿Ya tienes cuenta? <a href="/login">Entrar</a></p>
</main>
