<script lang="ts">
  import { onMount } from 'svelte';
  import { EQUIPMENT, MUSCLE_GROUPS, libraryExerciseListResponseSchema, type LibraryExerciseDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { EQUIPMENT_LABELS, MUSCLE_LABELS, equipment as eqLabel, muscle as muscleLabel } from '#lib/labels';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';

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
  <p class="muted"><a href="/programs">← Entrenar</a></p>
  <h1>Biblioteca de ejercicios</h1>
  {#if stale}<p class="muted">Sin conexión: mostrando la última biblioteca descargada.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="filters">
    <input type="search" placeholder="Buscar ejercicio" bind:value={q} />
    <select bind:value={muscleFilter} aria-label="Músculo">
      <option value="">Todos los músculos</option>
      {#each MUSCLE_GROUPS as m}<option value={m}>{MUSCLE_LABELS[m]}</option>{/each}
    </select>
    <select bind:value={equipmentFilter} aria-label="Equipo">
      <option value="">Todo el equipo</option>
      {#each EQUIPMENT as e}<option value={e}>{EQUIPMENT_LABELS[e]}</option>{/each}
    </select>
    <label class="check"><input type="checkbox" bind:checked={mineOnly} /> Solo los míos</label>
  </div>

  <a class="add" href="/library/new">+ Nuevo ejercicio</a>

  {#if !loaded}
    <p class="muted">Cargando…</p>
  {:else if visible.length === 0}
    <p class="muted">No hay ejercicios con esos filtros.</p>
  {:else}
    <ul class="list">
      {#each visible as e (e.id)}
        <li>
          <a href={`/library/${e.id}`}>
            <strong>{e.name}{e.isCustom ? ' ·  propio' : ''}</strong>
            <span class="muted">{muscleLabel(e.primaryMuscle)} · {eqLabel(e.equipment)}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<AppNav />

<style>
  .filters {
    display: grid;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .add {
    display: inline-block;
    margin-bottom: 0.5rem;
  }
</style>
