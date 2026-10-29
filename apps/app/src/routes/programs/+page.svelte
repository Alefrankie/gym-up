<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { programListResponseSchema, type ProgramListResponse, type ProgramSummaryDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
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

  const active = $derived(data?.mine.find((p) => p.id === data?.activeProgramId) ?? null);
  const others = $derived(data?.mine.filter((p) => p.id !== data?.activeProgramId) ?? []);
</script>

<main>
  <h1>Entrenar</h1>
  <SyncBanner />
  {#if stale}<p class="muted">Sin conexión: mostrando los últimos programas descargados.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if !data && !error}
    <p class="muted">Cargando…</p>
  {:else if data}
    {#if active}
      <a class="card hero current" href={`/programs/${active.id}`}>
        <span class="badge">Programa activo</span>
        <span class="name">{active.name}</span>
        <span class="muted">{sub(active)}</span>
        <span class="open">Ver y editar <Icon name="right" size={18} /></span>
      </a>
    {/if}

    <a class="library" href="/library">
      <Icon name="book" size={22} />
      <span class="grow"><strong>Biblioteca de ejercicios</strong><span class="muted">Músculos, equipo y cómo se hace</span></span>
      <Icon name="right" size={20} />
    </a>

    {#if others.length}
      <h2>Mis programas</h2>
      <ul class="list">
        {#each others as p (p.id)}
          <li>
            <a href={`/programs/${p.id}`}>
              <span class="grow"><strong>{p.name}</strong><span class="muted">{sub(p)}</span></span>
            </a>
            {#if p.routineCount > 0}
              <button class="side" disabled={busy} onclick={() => activate(p)}>Activar</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <form class="new" onsubmit={create}>
      <input required maxlength="60" placeholder="Nombre del nuevo programa" aria-label="Nombre del nuevo programa" bind:value={newName} />
      <button disabled={busy}><Icon name="plus" size={18} /> Crear</button>
    </form>

    <h2>Plantillas</h2>
    <ul class="list">
      {#each data.templates as p (p.id)}
        <li>
          <a href={`/programs/${p.id}`}>
            <Icon name="dumbbell" size={22} />
            <span class="grow"><strong>{p.name}</strong><span class="muted">{sub(p)}</span></span>
          </a>
          <button class="side" disabled={busy} onclick={() => adopt(p)}>Usar</button>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<AppNav />

<style>
  .current {
    display: grid;
    gap: 0.35rem;
    justify-items: start;
    text-decoration: none;
    color: var(--text);
  }
  .name {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 2rem;
    line-height: 1.05;
  }
  .open {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    margin-top: 0.4rem;
    color: var(--accent-hi);
    font-weight: 600;
  }
  .library {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.8rem 0.9rem;
    border-radius: var(--radius);
    background: linear-gradient(180deg, var(--surface-hi), var(--surface));
    box-shadow: var(--shadow-card);
    color: var(--text);
    text-decoration: none;
  }
  .library .grow {
    flex: 1;
    display: grid;
  }
  .side {
    min-width: 4.6rem;
    padding: 0 0.9rem;
  }
  .new {
    display: flex;
    gap: 0.5rem;
    margin: 1.2rem 0 0;
  }
  .new input {
    flex: 1;
  }
</style>
