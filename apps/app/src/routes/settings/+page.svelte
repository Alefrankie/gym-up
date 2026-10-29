<script lang="ts">
  import { onMount } from 'svelte';
  import { updateProfileRequestSchema, userSchema, type UpdateProfileRequest } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { API_URL } from '#lib/api/config';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';
  import Icon from '#lib/components/Icon.svelte';

  let displayName = $state('');
  let weightUnit = $state<'kg' | 'lbs'>('kg');
  let routineType = $state<'hombre' | 'mujer'>('hombre');
  let message = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  onMount(async () => {
    const user = await session.require();
    if (!user) return;
    displayName = user.displayName;
    weightUnit = user.weightUnit;
    routineType = user.routineType;
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    message = null;
    error = null;
    const body: UpdateProfileRequest = { displayName, weightUnit, routineType };
    if (!updateProfileRequestSchema.safeParse(body).success) {
      error = 'Revisa el nombre (no puede estar vacío)';
      return;
    }
    busy = true;
    try {
      const user = await api('/auth/me', { method: 'PATCH', body, schema: userSchema });
      await session.set(user);
      message = 'Cambios guardados. Tu rutina de hoy se actualizará al volver al inicio.';
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión: los ajustes necesitan internet para guardarse.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudieron guardar los cambios';
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <h1>Ajustes</h1>
  <SyncBanner />
  <section class="card">
    <h2 class="first">Perfil</h2>
    <form onsubmit={save}>
      <label>
        Nombre
        <input bind:value={displayName} maxlength="80" required />
      </label>
      <label>
        Unidad de peso
        <select bind:value={weightUnit}>
          <option value="kg">kilogramos (kg)</option>
          <option value="lbs">libras (lbs)</option>
        </select>
      </label>
      <label>
        Rutina
        <select bind:value={routineType}>
          <option value="hombre">Hombre</option>
          <option value="mujer">Mujer</option>
        </select>
      </label>
      {#if message}<p class="ok" role="status">{message}</p>{/if}
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button class="primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
    </form>
  </section>

  <section class="card">
    <h2 class="first">Cuenta</h2>
    <p class="muted email">{session.user?.email}</p>
    <button type="button" class="out" onclick={() => session.signOut()}>
      <Icon name="logout" size={20} /> Cerrar sesión
    </button>
  </section>

  <p class="muted small">Servidor: {API_URL}</p>
</main>

<AppNav />

<style>
  .first {
    margin-top: 0;
  }
  .email {
    overflow-wrap: anywhere;
  }
  .out {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .small {
    font-size: 0.8rem;
    word-break: break-all;
  }
</style>
