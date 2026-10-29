<script lang="ts">
  import Select from '#lib/components/Select.svelte';
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
      const res = await cachedGet('/exercises', libraryExerciseListResponseSchema, { onCached: (c) => ((items = c.data.items), (loaded = true)) });
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
  <p><a class="back" href="/programs"><Icon name="left" size={16} /> Entrenar</a></p>
  <h1>Biblioteca</h1>
  {#if stale}<p class="muted">Sin conexión: mostrando la última biblioteca descargada.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="search">
    <Icon name="search" size={16} />
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
    <Select bind:value={equipmentFilter} label="Equipo" options={[{ value: '', label: 'Todo el equipo' }, ...EQUIPMENT.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))]} />
    <label class="mine"><input type="checkbox" bind:checked={mineOnly} /> Solo los míos</label>
  </div>

  <p class="count muted">{visible.length} {visible.length === 1 ? 'ejercicio' : 'ejercicios'}</p>

  {#if !loaded}
    <p class="muted loading">Cargando…</p>
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
            <MuscleFigure primary={e.primaryMuscle} secondary={e.secondaryMuscles} size={22} />
            <span class="grow">
              <strong>{e.name}{#if e.isCustom} <span class="badge">propio</span>{/if}</strong>
              <span class="muted">{muscleLabel(e.primaryMuscle)} · {eqLabel(e.equipment)}</span>
            </span>
            <Icon name="right" size={16} />
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<a class="fab" href="/library/new" aria-label="Nuevo ejercicio"><Icon name="plus" size={20} /></a>
<AppNav />

<style>
  .search {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 0.6rem;
    color: var(--faint);
  }
  .search :global(svg) {
    position: absolute;
    left: 0.75rem;
    pointer-events: none;
  }
  .search input {
    flex: 1;
    padding-left: 2.3rem;
  }
  .chips {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    margin: 0 -1rem 0.6rem;
    padding: 0.1rem 1rem 0.3rem;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chips .chip {
    flex: none;
    min-height: 32px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .row :global(.select) {
    flex: 1;
  }
  .mine {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    white-space: nowrap;
    font-size: var(--t-sm);
  }
  .count {
    margin: 1rem 0 0;
    font-size: var(--t-xs);
  }
  .list a > :global(svg:last-child) {
    flex: none;
    color: var(--faint);
  }
  .empty {
    text-align: center;
  }
  .fab {
    position: fixed;
    right: 1rem;
    bottom: calc(5.4rem + env(safe-area-inset-bottom));
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--surface-hi);
    box-shadow: var(--shadow-pop);
    color: var(--accent);
  }
</style>
