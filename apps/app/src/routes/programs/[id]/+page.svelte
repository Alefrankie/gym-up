<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import {
    PROGRAM_LIMITS,
    libraryExerciseListResponseSchema,
    programDetailDtoSchema,
    type LibraryExerciseDto,
    type ProgramDetailDto,
  } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { muscle } from '#lib/labels';
  import { session } from '#lib/session';

  const id = $derived(page.params.id ?? '');

  interface DraftExercise {
    key: string;
    id?: string;
    exerciseId: string;
    exerciseName: string;
    targetSets: number;
    targetRepsMin: number;
    targetRepsMax: number;
    warmupSets: number;
    restSeconds: number | null;
    notes: string | null;
  }
  interface DraftRoutine {
    key: string;
    id?: string;
    name: string;
    focus: string;
    notes: string | null;
    exercises: DraftExercise[];
  }

  let program = $state<ProgramDetailDto | null>(null);
  let draft = $state<DraftRoutine[]>([]);
  let name = $state('');
  let library = $state<LibraryExerciseDto[]>([]);
  let pickerFor = $state<number | null>(null);
  let pickerQuery = $state('');
  let error = $state<string | null>(null);
  let saved = $state(false);
  let busy = $state(false);
  let dirty = $state(false);

  const editable = $derived(!!program && !program.isTemplate);

  function toDraft(p: ProgramDetailDto): DraftRoutine[] {
    return p.routines.map((r) => ({
      key: r.id,
      id: r.id,
      name: r.name,
      focus: r.focus,
      notes: r.notes,
      exercises: r.exercises.map((e) => ({ ...e, key: e.id })),
    }));
  }

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const res = await cachedGet(`/programs/${id}`, programDetailDtoSchema);
      program = res.data;
      name = program.name;
      draft = toDraft(program);
      if (!program.isTemplate) {
        library = (await cachedGet('/exercises', libraryExerciseListResponseSchema)).data.items;
      }
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y este programa no está guardado.'
          : e instanceof ApiRequestError && e.status === 404
            ? 'Programa no encontrado'
            : 'No se pudo cargar el programa';
    }
  });

  const touch = () => {
    dirty = true;
    saved = false;
  };

  function addRoutine() {
    if (draft.length >= PROGRAM_LIMITS.routines) return;
    draft.push({ key: crypto.randomUUID(), name: `Rutina ${draft.length + 1}`, focus: '', notes: null, exercises: [] });
    touch();
  }

  function removeRoutine(i: number) {
    if (!confirm(`¿Quitar "${draft[i]!.name}" del programa?`)) return;
    draft.splice(i, 1);
    touch();
  }

  function move<T>(list: T[], i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    touch();
  }

  function pick(ri: number, ex: LibraryExerciseDto) {
    const r = draft[ri]!;
    if (r.exercises.length >= PROGRAM_LIMITS.exercises) return;
    r.exercises.push({
      key: crypto.randomUUID(),
      exerciseId: ex.id,
      exerciseName: ex.name,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      warmupSets: 0,
      restSeconds: null,
      notes: null,
    });
    pickerFor = null;
    pickerQuery = '';
    touch();
  }

  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const matches = $derived(
    library.filter((e) => !pickerQuery || norm(e.name).includes(norm(pickerQuery))).slice(0, 30),
  );

  async function save() {
    busy = true;
    error = null;
    try {
      const body = {
        name,
        routines: draft.map((r) => ({
          id: r.id,
          name: r.name,
          focus: r.focus,
          notes: r.notes,
          exercises: r.exercises.map((e) => ({
            id: e.id,
            exerciseId: e.exerciseId,
            targetSets: e.targetSets,
            targetRepsMin: e.targetRepsMin,
            targetRepsMax: Math.max(e.targetRepsMin, e.targetRepsMax),
            warmupSets: e.warmupSets,
            restSeconds: e.restSeconds,
            notes: e.notes,
          })),
        })),
      };
      program = await api(`/programs/${id}`, { method: 'PUT', body, schema: programDetailDtoSchema });
      draft = toDraft(program);
      await invalidateCache(['/programs', '/workouts/today']);
      dirty = false;
      saved = true;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión: conéctate para guardar el programa.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudo guardar';
    }
    busy = false;
  }

  async function adopt() {
    busy = true;
    try {
      const copy = await api<ProgramDetailDto>(`/programs/${id}/adopt`, { method: 'POST', schema: programDetailDtoSchema });
      await invalidateCache(['/programs', '/workouts/today']);
      await goto(`/programs/${copy.id}`);
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'Necesitas conexión para usar esta plantilla';
      busy = false;
    }
  }

  async function archive() {
    if (!confirm('¿Archivar este programa? Tu historial no se borra.')) return;
    busy = true;
    try {
      await api(`/programs/${id}`, { method: 'DELETE' });
      await invalidateCache(['/programs', '/workouts/today']);
      await goto('/programs');
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'No se pudo archivar';
      busy = false;
    }
  }
</script>

<main>
  <p class="muted"><a href="/programs">← Entrenar</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !program && !error}
    <p class="muted">Cargando…</p>
  {:else if program}
    {#if editable}
      <label>Nombre del programa <input maxlength="60" bind:value={name} oninput={touch} /></label>
    {:else}
      <h1>{program.name}</h1>
      {#if program.description}<p class="muted">{program.description}</p>{/if}
      <button class="primary" disabled={busy} onclick={adopt}>Usar este programa</button>
    {/if}

    {#each draft as r, ri (r.key)}
      <section class="card">
        {#if editable}
          <div class="head">
            <input class="title" maxlength="60" aria-label="Nombre de la rutina" bind:value={r.name} oninput={touch} />
            <button aria-label="Subir" disabled={ri === 0} onclick={() => move(draft, ri, -1)}>↑</button>
            <button aria-label="Bajar" disabled={ri === draft.length - 1} onclick={() => move(draft, ri, 1)}>↓</button>
            <button aria-label="Quitar rutina" onclick={() => removeRoutine(ri)}>✕</button>
          </div>
          <input placeholder="Enfoque (ej. Pecho + Tríceps)" maxlength="80" bind:value={r.focus} oninput={touch} />
        {:else}
          <h2>{ri + 1}. {r.name}</h2>
          <p class="muted">{r.focus}</p>
        {/if}

        <ul class="exlist">
          {#each r.exercises as e, ei (e.key)}
            <li>
              <div class="line">
                <strong>{e.exerciseName}</strong>
                {#if editable}
                  <span class="mini">
                    <button aria-label="Subir ejercicio" disabled={ei === 0} onclick={() => move(r.exercises, ei, -1)}>↑</button>
                    <button aria-label="Bajar ejercicio" disabled={ei === r.exercises.length - 1} onclick={() => move(r.exercises, ei, 1)}>↓</button>
                    <button aria-label="Quitar ejercicio" onclick={() => { r.exercises.splice(ei, 1); touch(); }}>✕</button>
                  </span>
                {/if}
              </div>
              {#if editable}
                <div class="targets">
                  <label>Series <input type="number" min="1" max={PROGRAM_LIMITS.maxSets} bind:value={e.targetSets} oninput={touch} /></label>
                  <label>Reps mín <input type="number" min="1" max={PROGRAM_LIMITS.maxReps} bind:value={e.targetRepsMin} oninput={touch} /></label>
                  <label>Reps máx <input type="number" min="1" max={PROGRAM_LIMITS.maxReps} bind:value={e.targetRepsMax} oninput={touch} /></label>
                </div>
              {:else}
                <span class="muted">
                  {e.targetSets} x {e.targetRepsMin === e.targetRepsMax ? e.targetRepsMin : `${e.targetRepsMin}-${e.targetRepsMax}`}
                </span>
              {/if}
            </li>
          {/each}
        </ul>

        {#if editable}
          {#if pickerFor === ri}
            <div class="picker">
              <input placeholder="Buscar ejercicio" bind:value={pickerQuery} />
              <ul class="list">
                {#each matches as ex (ex.id)}
                  <li>
                    <button class="pick" onclick={() => pick(ri, ex)}>
                      <strong>{ex.name}</strong> <span class="muted">{muscle(ex.primaryMuscle)}</span>
                    </button>
                  </li>
                {/each}
              </ul>
              <button onclick={() => (pickerFor = null)}>Cancelar</button>
            </div>
          {:else}
            <button disabled={r.exercises.length >= PROGRAM_LIMITS.exercises} onclick={() => (pickerFor = ri)}>+ Añadir ejercicio</button>
          {/if}
        {/if}
      </section>
    {/each}

    {#if editable}
      <button disabled={draft.length >= PROGRAM_LIMITS.routines} onclick={addRoutine}>+ Añadir rutina</button>
      <button class="primary" disabled={busy || !dirty || !name.trim()} onclick={save}>Guardar programa</button>
      {#if saved}<p class="ok">Guardado</p>{/if}
      <p><button class="danger" disabled={busy} onclick={archive}>Archivar programa</button></p>
    {/if}
  {/if}
</main>

<style>
  .head {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .title {
    flex: 1;
    font-weight: 600;
  }
  .exlist {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0;
    display: grid;
    gap: 0.75rem;
  }
  .line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .mini {
    display: flex;
    gap: 0.25rem;
  }
  .mini button,
  .head button {
    padding: 0.4rem 0.6rem;
  }
  .targets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin-top: 0.4rem;
    font-size: 0.85rem;
  }
  .picker {
    display: grid;
    gap: 0.5rem;
  }
  .pick {
    width: 100%;
    text-align: left;
  }
  .danger {
    color: var(--danger);
    border-color: var(--danger);
  }
</style>
