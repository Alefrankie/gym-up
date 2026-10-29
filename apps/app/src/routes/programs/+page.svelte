<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { programListResponseSchema, type ProgramListResponse, type ProgramSummaryDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';

  let data = $state<ProgramListResponse | null>(null);
  let error = $state<string | null>(null);
  let stale = $state(false);
  let busy = $state(false);
  let newName = $state('');

  async function load() {
    try {
      const res = await cachedGet('/programs', programListResponseSchema);
      data = res.data;
      stale = res.stale;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y sin programas guardados todavía.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudieron cargar los programas';
    }
  }

  onMount(async () => {
    if (await session.require()) await load();
  });

  async function changed() {
    await invalidateCache(['/programs', '/workouts/today']);
  }

  async function adopt(p: ProgramSummaryDto) {
    busy = true;
    error = null;
    try {
      await api(`/programs/${p.id}/adopt`, { method: 'POST' });
      await changed();
      await load();
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'Necesitas conexión para adoptar un programa';
    }
    busy = false;
  }

  async function activate(p: ProgramSummaryDto) {
    busy = true;
    error = null;
    try {
      await api(`/programs/${p.id}/activate`, { method: 'POST' });
      await changed();
      await load();
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'Necesitas conexión para cambiar de programa';
    }
    busy = false;
  }

  async function create(ev: SubmitEvent) {
    ev.preventDefault();
    busy = true;
    error = null;
    try {
      const id = crypto.randomUUID();
      await api('/programs', { method: 'POST', body: { id, name: newName } });
      await changed();
      await goto(`/programs/${id}`);
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'Necesitas conexión para crear un programa';
      busy = false;
    }
  }

  const goal: Record<string, string> = { hypertrophy: 'Hipertrofia', strength: 'Fuerza', general: 'General' };
  const level: Record<string, string> = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' };
  const sub = (p: ProgramSummaryDto) =>
    [`${p.routineCount} rutinas`, p.level && (level[p.level] ?? p.level), p.goal && (goal[p.goal] ?? p.goal)]
      .filter(Boolean)
      .join(' · ');
</script>

<main>
  <h1>Entrenar</h1>
  <SyncBanner />
  {#if stale}<p class="muted">Sin conexión: mostrando los últimos programas descargados.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <p><a href="/library">Biblioteca de ejercicios</a></p>

  {#if !data && !error}
    <p class="muted">Cargando…</p>
  {:else if data}
    <h2>Mis programas</h2>
    {#if data.mine.length === 0}
      <p class="muted">Aún no tienes programas propios. Adopta una plantilla o crea uno desde cero.</p>
    {:else}
      <ul class="list">
        {#each data.mine as p (p.id)}
          <li class="row">
            <a href={`/programs/${p.id}`}>
              <strong>{p.name}{p.id === data.activeProgramId ? ' · activo' : ''}</strong>
              <span class="muted">{sub(p)}</span>
            </a>
            {#if p.id !== data.activeProgramId && p.routineCount > 0}
              <button disabled={busy} onclick={() => activate(p)}>Activar</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <form class="new" onsubmit={create}>
      <input required maxlength="60" placeholder="Nombre del nuevo programa" bind:value={newName} />
      <button disabled={busy}>Crear</button>
    </form>

    <h2>Plantillas</h2>
    <ul class="list">
      {#each data.templates as p (p.id)}
        <li class="row">
          <a href={`/programs/${p.id}`}>
            <strong>{p.name}</strong>
            <span class="muted">{sub(p)}</span>
          </a>
          <button disabled={busy} onclick={() => adopt(p)}>Usar</button>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<AppNav />

<style>
  .row {
    align-items: stretch;
  }
  .row a {
    flex: 1;
  }
  .new {
    display: flex;
    gap: 0.5rem;
    margin: 0 0 1.25rem;
  }
  .new input {
    flex: 1;
  }
</style>
