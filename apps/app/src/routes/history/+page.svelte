<script lang="ts">
  import { onMount } from 'svelte';
  import { workoutHistoryResponseSchema, type WorkoutHistoryResponse } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';
  import Icon from '#lib/components/Icon.svelte';

  let history = $state<WorkoutHistoryResponse | null>(null);
  let page = $state(1);
  let error = $state<string | null>(null);
  let stale = $state(false);

  async function load(p: number) {
    error = null;
    try {
      const res = await cachedGet(`/workouts?page=${p}`, workoutHistoryResponseSchema);
      history = res.data;
      stale = res.stale;
      page = p;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y sin historial guardado todavía.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudo cargar el historial';
    }
  }

  onMount(async () => {
    if (await session.require()) await load(1);
  });

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
</script>

<main>
  <h1>Historial</h1>
  <SyncBanner />
  {#if stale}<p class="muted">Sin conexión: mostrando el último historial descargado.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !history && !error}
    <p class="muted">Cargando…</p>
  {:else if history && history.items.length === 0}
    <section class="card empty">
      <Icon name="dumbbell" size={32} />
      <p>Todavía no hay entrenamientos.</p>
      <a href="/dashboard">Empieza el de hoy</a>
    </section>
  {:else if history}
    <ul class="list">
      {#each history.items as item}
        <li>
          <a href={`/workout/${item.id}`}>
            <span class="ico"><Icon name="dumbbell" size={20} /></span>
            <span class="grow">
              <strong>{item.routineDayName} {#if item.status === 'in_progress'}<span class="badge">En curso</span>{/if}</strong>
              <span class="muted meta">{fmt(item.workoutDate)} · {item.exerciseCount} ejercicios</span>
            </span>
            <span class="vol"><b>{Math.round(item.totalVolume)}</b> kg</span>
          </a>
        </li>
      {/each}
    </ul>
    {#if history.totalPages > 1}
      <div class="pager">
        <button disabled={page <= 1} onclick={() => load(page - 1)}>Anterior</button>
        <span class="muted">{page} / {history.totalPages}</span>
        <button disabled={page >= history.totalPages} onclick={() => load(page + 1)}>Siguiente</button>
      </div>
    {/if}
  {/if}
</main>

<AppNav />

<style>
  .ico {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    color: var(--accent-hi);
    flex: none;
  }
  .meta {
    font-size: 0.88rem;
  }
  .vol {
    color: var(--muted);
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .vol b {
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--text);
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 0.4rem;
    text-align: center;
    padding: 2rem 1rem;
    color: var(--muted);
  }
  .empty p {
    margin: 0;
  }
  .pager {
    margin-top: 0.5rem;
  }
</style>
