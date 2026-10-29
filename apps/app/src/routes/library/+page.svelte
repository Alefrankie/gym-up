<script lang="ts">
  import { onMount } from 'svelte';
  import { EQUIPMENT, libraryExerciseListResponseSchema, type LibraryExerciseDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { EQUIPMENT_LABELS, equipment as eqLabel, muscle as muscleLabel } from '#lib/labels';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';

  // The groups people actually think in; the full taxonomy still applies to each exercise.
  const FILTER_MUSCLES = [
    'chest',
    'upper_back',
    'lats',
    'shoulders',
    'biceps',
    'triceps',
    'forearms',
    'abdominals',
    'quadriceps',
    'hamstrings',
    'glutes',
    'calves',
  ];

  let items = $state<LibraryExerciseDto[]>([]);
  let loaded = $state(false);
  let error = $state<string | null>(null);
  let stale = $state(false);
  let q = $state('');
  let muscleFilter = $state('');
  let equipmentFilter = $state('');
  let mineOnly = $state(false);

  // The whole catalog is small (tens of rows), so it is fetched once and filtered on the device: instant and offline.
  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const res = await cachedGet('/exercises', libraryExerciseListResponseSchema);
      items = res.data.items;
      stale = res.stale;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y sin biblioteca guardada todavía.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudo cargar la biblioteca';
    }
    loaded = true;
  });

  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const visible = $derived(
    items.filter(
      (e) =>
        (!q || norm(e.name).includes(norm(q))) &&
        (!muscleFilter || e.primaryMuscle === muscleFilter || e.secondaryMuscles.includes(muscleFilter)) &&
        (!equipmentFilter || e.equipment === equipmentFilter) &&
        (!mineOnly || (e.isCustom && e.ownerId === session.user?.id)),
    ),
  );
</script>

<main>
  <p><a class="back" href="/programs"><Icon name="left" size={18} /> Entrenar</a></p>
  <h1>Biblioteca</h1>
  {#if stale}<p class="muted">Sin conexión: mostrando la última biblioteca descargada.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="search">
    <Icon name="search" size={20} />
    <input type="search" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" bind:value={q} />
  </div>

  <div class="chips" role="group" aria-label="Músculo">
    <button class="chip" class:on={!muscleFilter} onclick={() => (muscleFilter = '')}>Todos</button>
    {#each FILTER_MUSCLES as m}
      <button class="chip" class:on={muscleFilter === m} onclick={() => (muscleFilter = muscleFilter === m ? '' : m)}>
        <MuscleFigure primary={m} size={14} />{muscleLabel(m)}
      </button>
    {/each}
  </div>

  <div class="row">
    <select bind:value={equipmentFilter} aria-label="Equipo">
      <option value="">Todo el equipo</option>
      {#each EQUIPMENT as e}<option value={e}>{EQUIPMENT_LABELS[e]}</option>{/each}
    </select>
    <label class="mine"><input type="checkbox" bind:checked={mineOnly} /> Solo los míos</label>
  </div>

  <p class="count muted">{visible.length} {visible.length === 1 ? 'ejercicio' : 'ejercicios'}</p>

  {#if !loaded}
    <p class="muted">Cargando…</p>
  {:else if visible.length === 0}
    <section class="card empty">
      <p>Ningún ejercicio coincide.</p>
      <a href="/library/new">Crear un ejercicio propio</a>
    </section>
  {:else}
    <ul class="list">
      {#each visible as e (e.id)}
        <li>
          <a href={`/library/${e.id}`}>
            <MuscleFigure primary={e.primaryMuscle} secondary={e.secondaryMuscles} size={26} />
            <span class="grow">
              <strong>{e.name}{#if e.isCustom} <span class="badge">propio</span>{/if}</strong>
              <span class="muted">{muscleLabel(e.primaryMuscle)} · {eqLabel(e.equipment)}</span>
            </span>
            <Icon name="right" size={20} />
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<a class="fab" href="/library/new" aria-label="Nuevo ejercicio"><Icon name="plus" size={26} /></a>
<AppNav />

<style>
  .search {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 0.75rem;
    color: var(--muted);
  }
  .search :global(svg) {
    position: absolute;
    left: 0.8rem;
    pointer-events: none;
  }
  .search input {
    flex: 1;
    padding-left: 2.6rem;
  }
  .chips {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    margin: 0 -1rem 0.75rem;
    padding: 0.2rem 1rem 0.5rem;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chips .chip {
    flex: none;
    min-height: 40px;
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .chips .chip.on {
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .row select {
    flex: 1;
  }
  .mine {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }
  .count {
    margin: 0.9rem 0 0;
    font-size: 0.9rem;
  }
  .empty {
    text-align: center;
  }
  .fab {
    position: fixed;
    right: 1rem;
    bottom: calc(5.6rem + env(safe-area-inset-bottom));
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(180deg, var(--accent-hi), var(--accent));
    box-shadow: var(--shadow-accent);
    color: var(--accent-ink);
  }
</style>
