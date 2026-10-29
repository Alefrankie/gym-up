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
  import { equipment as eqLabel, muscle } from '#lib/labels';
  import { session } from '#lib/session';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';

  const id = $derived(page.params.id ?? '');

  interface DraftExercise {
    key: string;
    id?: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    targetSets: number;
    targetReps: number;
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
      muscleGroup: ex.primaryMuscle,
      targetSets: 3,
      targetReps: 10,
      warmupSets: 0,
      restSeconds: null,
      notes: null,
    });
    pickerFor = null;
    pickerQuery = '';
    touch();
  }

  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const matches = $derived(library.filter((e) => !pickerQuery || norm(e.name).includes(norm(pickerQuery))).slice(0, 30));

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
            targetReps: e.targetReps,
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
  <p><a class="back" href="/programs"><Icon name="left" size={18} /> Entrenar</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !program && !error}
    <p class="muted">Cargando…</p>
  {:else if program}
    {#if editable}
      <label class="pname">
        Nombre del programa
        <input maxlength="60" bind:value={name} oninput={touch} />
      </label>
    {:else}
      <h1>{program.name}</h1>
      {#if program.description}<p class="muted">{program.description}</p>{/if}
      <button class="primary" disabled={busy} onclick={adopt}>Usar este programa</button>
    {/if}

    {#each draft as r, ri (r.key)}
      <section class="card routine">
        <header>
          <span class="num">{ri + 1}</span>
          {#if editable}
            <div class="titles">
              <input class="title" maxlength="60" aria-label="Nombre de la rutina" bind:value={r.name} oninput={touch} />
              <input class="focus" placeholder="Enfoque (ej. Pecho y tríceps)" maxlength="80" aria-label="Enfoque" bind:value={r.focus} oninput={touch} />
            </div>
            <div class="tools">
              <button class="icon ghost" aria-label="Subir rutina" disabled={ri === 0} onclick={() => move(draft, ri, -1)}><Icon name="up" size={20} /></button>
              <button class="icon ghost" aria-label="Bajar rutina" disabled={ri === draft.length - 1} onclick={() => move(draft, ri, 1)}><Icon name="down" size={20} /></button>
              <button class="icon ghost" aria-label="Quitar rutina" onclick={() => removeRoutine(ri)}><Icon name="trash" size={20} /></button>
            </div>
          {:else}
            <div class="titles">
              <h2>{r.name}</h2>
              <span class="muted">{r.focus}</span>
            </div>
          {/if}
        </header>

        <ul class="exlist">
          {#each r.exercises as e, ei (e.key)}
            <li>
              <MuscleFigure primary={e.muscleGroup} size={24} />
              <div class="body">
                <strong>{e.exerciseName}</strong>
                {#if editable}
                  <div class="targets">
                    <label>
                      Series
                      <input type="number" inputmode="numeric" min="1" max={PROGRAM_LIMITS.maxSets} bind:value={e.targetSets} oninput={touch} />
                    </label>
                    <label>
                      Reps
                      <input type="number" inputmode="numeric" min="1" max={PROGRAM_LIMITS.maxReps} bind:value={e.targetReps} oninput={touch} />
                    </label>
                  </div>
                {:else}
                  <span class="muted">{e.targetSets} × {e.targetReps}</span>
                {/if}
              </div>
              {#if editable}
                <div class="mini">
                  <button class="icon ghost" aria-label="Subir ejercicio" disabled={ei === 0} onclick={() => move(r.exercises, ei, -1)}><Icon name="up" size={18} /></button>
                  <button class="icon ghost" aria-label="Bajar ejercicio" disabled={ei === r.exercises.length - 1} onclick={() => move(r.exercises, ei, 1)}><Icon name="down" size={18} /></button>
                  <button class="icon ghost" aria-label="Quitar ejercicio" onclick={() => { r.exercises.splice(ei, 1); touch(); }}><Icon name="x" size={18} /></button>
                </div>
              {/if}
            </li>
          {/each}
        </ul>

        {#if editable}
          {#if pickerFor === ri}
            <div class="picker">
              <div class="search">
                <Icon name="search" size={20} />
                <input placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" bind:value={pickerQuery} />
              </div>
              <ul class="list">
                {#each matches as ex (ex.id)}
                  <li>
                    <button class="pick" onclick={() => pick(ri, ex)}>
                      <MuscleFigure primary={ex.primaryMuscle} secondary={ex.secondaryMuscles} size={22} />
                      <span class="grow"><strong>{ex.name}</strong><span class="muted">{muscle(ex.primaryMuscle)} · {eqLabel(ex.equipment)}</span></span>
                      <Icon name="plus" size={20} />
                    </button>
                  </li>
                {/each}
              </ul>
              <button class="ghost" onclick={() => (pickerFor = null)}>Cancelar</button>
            </div>
          {:else}
            <button class="add" disabled={r.exercises.length >= PROGRAM_LIMITS.exercises} onclick={() => (pickerFor = ri)}>
              <Icon name="plus" size={18} /> Añadir ejercicio
            </button>
          {/if}
        {/if}
      </section>
    {/each}

    {#if editable}
      <button class="add" disabled={draft.length >= PROGRAM_LIMITS.routines} onclick={addRoutine}><Icon name="plus" size={18} /> Añadir rutina</button>
      {#if dirty || saved}
        <div class="savebar">
          {#if saved}<span class="ok"><Icon name="check" size={18} /> Guardado</span>{/if}
          {#if dirty}<button class="primary" disabled={busy || !name.trim()} onclick={save}>Guardar cambios</button>{/if}
        </div>
      {/if}
      <p><button class="danger" disabled={busy} onclick={archive}><Icon name="trash" size={18} /> Archivar programa</button></p>
    {/if}
  {/if}
</main>

<style>
  .pname {
    margin: 0.5rem 0 1rem;
  }
  .routine header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.7rem;
    margin-bottom: 0.8rem;
  }
  .num {
    flex: none;
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    background: linear-gradient(180deg, var(--accent-hi), var(--accent));
    color: var(--accent-ink);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.2rem;
  }
  .titles {
    flex: 1 1 10rem;
    min-width: 0;
    display: grid;
    gap: 0.4rem;
  }
  .titles h2 {
    margin: 0;
  }
  .title {
    font-weight: 700;
  }
  .focus {
    min-height: 40px;
    font-size: 0.92rem;
  }
  .tools {
    flex: 1 0 100%;
    display: flex;
    justify-content: flex-end;
    margin-top: -0.2rem;
  }
  .exlist {
    list-style: none;
    padding: 0;
    margin: 0 0 0.8rem;
    display: grid;
    gap: 0.5rem;
  }
  .exlist li {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.6rem 0.7rem;
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: 0 2px 5px rgb(0 0 0 / 0.35) inset;
  }
  .body {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.3rem;
  }
  .targets {
    display: flex;
    gap: 0.6rem;
  }
  .targets label {
    flex: 1;
    font-size: 0.78rem;
  }
  .targets input {
    min-height: 44px;
    text-align: center;
    font-weight: 700;
    font-size: 1.1rem;
  }
  .mini {
    display: grid;
  }
  .mini .icon {
    min-height: 36px;
    height: 36px;
  }
  .add {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin-bottom: 1rem;
    color: var(--accent-hi);
  }
  .picker {
    display: grid;
    gap: 0.5rem;
  }
  .search {
    position: relative;
    display: flex;
    align-items: center;
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
  .pick {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    text-align: left;
  }
  .pick .grow {
    flex: 1;
    display: grid;
  }
  .savebar {
    position: sticky;
    bottom: calc(0.75rem + env(safe-area-inset-bottom));
    display: grid;
    gap: 0.4rem;
    justify-items: center;
  }
  .savebar .primary {
    margin-top: 0;
  }
</style>
