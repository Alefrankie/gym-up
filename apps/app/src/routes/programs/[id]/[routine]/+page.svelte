<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import {
    PROGRAM_LIMITS,
    libraryExerciseListResponseSchema,
    programDetailDtoSchema,
    type LibraryExerciseDto,
    type ProgramDetailDto,
    type SetPlan,
  } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { muscleLoad } from '#lib/muscle-load';
  import { muscle } from '#lib/labels';
  import { saveBody } from '#lib/programs';
  import { session } from '#lib/session';
  import ExercisePicker from '#lib/components/ExercisePicker.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';
  import SortableRows from '#lib/components/SortableRows.svelte';
  import SetPlanEditor from '#lib/components/SetPlanEditor.svelte';
  import TargetMuscles from '#lib/components/TargetMuscles.svelte';
  import UndoToast from '#lib/components/UndoToast.svelte';

  interface Draft {
    key: string;
    id?: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    secondaryMuscles: string[];
    targetSets: number;
    targetReps: number;
    warmupSets: number;
    restSeconds: number | null;
    notes: string | null;
    sets: SetPlan;
  }

  /** Reps and kind of each set; old routines without a plan get `targetSets` normal sets. */
  const planOf = (e: { sets?: SetPlan | null; targetSets: number; targetReps: number }): SetPlan =>
    e.sets?.length ? e.sets.map((s) => ({ ...s })) : Array.from({ length: e.targetSets }, () => ({ reps: e.targetReps, type: 'normal' as const }));

  /** Keeps the summary columns in step with the plan. */
  function planChanged(e: Draft) {
    e.targetSets = e.sets.length;
    e.targetReps = (e.sets.find((s) => s.type === 'normal') ?? e.sets[0]!).reps;
    e.warmupSets = e.sets.filter((s) => s.type === 'warmup').length;
    touch();
  }

  const programId = $derived(page.params.id ?? '');
  const routineId = $derived(page.params.routine ?? '');

  let detail = $state<ProgramDetailDto | null>(null);
  let name = $state('');
  let focus = $state('');
  let exercises = $state<Draft[]>([]);
  let library = $state<LibraryExerciseDto[]>([]);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let dirty = $state(false);
  let saved = $state(false);
  let open = $state<string | null>(null);
  let picker = $state<{ mode: 'add' } | { mode: 'replace'; target: Draft } | null>(null);
  let removed = $state<{ item: Draft; index: number } | null>(null);

  const editable = $derived(!!detail && !detail.isTemplate);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      // The saved copy paints at once; the server copy replaces it, since saving sends the whole program.
      const show = (d: ProgramDetailDto) => {
        detail = d;
        const r = d.routines.find((x) => x.id === routineId);
        if (!r) return false;
        name = r.name;
        focus = r.focus;
        exercises = r.exercises.map((e) => ({ ...e, key: e.id, secondaryMuscles: e.secondaryMuscles ?? [], sets: planOf(e) }));
        return true;
      };
      const res = await cachedGet(`/programs/${programId}`, programDetailDtoSchema, { onCached: (c) => void show(c.data) });
      if (!show(res.data)) {
        error = 'Rutina no encontrada';
        return;
      }
      if (res.stale) error = 'Sin conexión: puedes ver la rutina, pero guardar necesita conexión.';
      if (!res.data.isTemplate) library = (await cachedGet('/exercises', libraryExerciseListResponseSchema)).data.items;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión: conéctate para ver y editar la rutina.'
          : e instanceof ApiRequestError && e.status === 404
            ? 'Programa no encontrado'
            : 'No se pudo cargar la rutina';
    }
  });

  const touch = () => {
    dirty = true;
    saved = false;
  };

  const fromLibrary = (ex: LibraryExerciseDto) => ({
    exerciseId: ex.id,
    exerciseName: ex.name,
    muscleGroup: ex.primaryMuscle,
    secondaryMuscles: ex.secondaryMuscles,
  });

  function pick(ex: LibraryExerciseDto) {
    const p = picker;
    picker = null;
    if (!p) return;
    if (p.mode === 'replace') {
      // The slot keeps its sets and reps; only the movement changes.
      const i = exercises.findIndex((e) => e.key === p.target.key);
      if (i >= 0) exercises[i] = { ...exercises[i]!, ...fromLibrary(ex) };
    } else if (exercises.length < PROGRAM_LIMITS.exercises) {
      const d: Draft = { key: crypto.randomUUID(), ...fromLibrary(ex), targetSets: 3, targetReps: 10, warmupSets: 0, restSeconds: null, notes: null, sets: planOf({ targetSets: 3, targetReps: 10 }) };
      exercises.push(d);
      open = d.key;
    }
    touch();
  }

  function remove(item: Draft) {
    const index = exercises.findIndex((e) => e.key === item.key);
    if (index < 0) return;
    exercises.splice(index, 1);
    removed = { item, index };
    touch();
  }

  function undo() {
    if (!removed) return;
    exercises.splice(removed.index, 0, removed.item);
    removed = null;
    touch();
  }

  async function save() {
    if (!detail) return;
    busy = true;
    error = null;
    try {
      const routines = detail.routines.map((r) =>
        r.id === routineId
          ? { ...r, name: name.trim() || r.name, focus, exercises: exercises.map((e) => ({ ...e, muscleGroup: e.muscleGroup, id: e.id ?? crypto.randomUUID() })) }
          : r,
      );
      detail = await api(`/programs/${programId}`, {
        method: 'PUT',
        body: saveBody(detail, { routines: routines as ProgramDetailDto['routines'] }),
        schema: programDetailDtoSchema,
      });
      const r = detail.routines.find((x) => x.id === routineId);
      if (r) exercises = r.exercises.map((e) => ({ ...e, key: e.id, secondaryMuscles: e.secondaryMuscles ?? [], sets: planOf(e) }));
      await invalidateCache(['/programs', '/workouts/today']);
      dirty = false;
      saved = true;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión: conéctate para guardar.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudo guardar';
    }
    busy = false;
  }
</script>

<main>
  <p><a class="back" href={`/programs/${programId}`}><Icon name="left" size={16} /> {detail?.name ?? 'Programa'}</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !detail && !error}
    <p class="muted loading">Cargando…</p>
  {:else if detail}
    {#if editable}
      <input class="title" maxlength="60" aria-label="Nombre de la rutina" placeholder="Nombre de la rutina" bind:value={name} oninput={touch} />
      <input class="focus" maxlength="80" aria-label="Enfoque" placeholder="Enfoque (ej. Pecho y tríceps)" bind:value={focus} oninput={touch} />
    {:else}
      <h1>{name}</h1>
      <p class="muted">{focus}</p>
    {/if}

    {#if exercises.length}
      <TargetMuscles muscles={muscleLoad(exercises)} />
    {/if}

    <div class="head">
      <h2>{exercises.length} {exercises.length === 1 ? 'ejercicio' : 'ejercicios'}</h2>
      {#if editable}
        <button class="icon add" onclick={() => (picker = { mode: 'add' })} disabled={exercises.length >= PROGRAM_LIMITS.exercises} aria-label="Añadir ejercicio">
          <Icon name="plus" size={18} />
        </button>
      {/if}
    </div>

    {#if exercises.length === 0}
      <section class="card empty">
        <p>Esta rutina no tiene ejercicios.</p>
        {#if editable}<button class="primary" onclick={() => (picker = { mode: 'add' })}>Añadir el primero</button>{/if}
      </section>
    {:else}
      <SortableRows
        items={exercises}
        key={(e) => e.key}
        disabled={!editable}
        onreorder={(next) => {
          exercises = next;
          touch();
        }}
        onremove={editable ? remove : undefined}
        onreplace={editable ? (item) => (picker = { mode: 'replace', target: item }) : undefined}
      >
        {#snippet row(e)}
          <div class="ex" class:open={open === e.key}>
            <button type="button" class="head-row" onclick={() => (open = open === e.key ? null : e.key)} aria-expanded={open === e.key}>
              <span class="tile"><MuscleFigure primary={e.muscleGroup} secondary={e.secondaryMuscles} size={22} /></span>
              <span class="grow">
                <strong>{e.exerciseName}</strong>
                <span class="muted">{muscle(e.muscleGroup)} · {e.targetSets} series · {e.targetReps} reps{#if e.sets.some((s) => s.type !== 'normal')} · {e.sets.filter((s) => s.type !== 'normal').map((s) => ({ warmup: 'C', drop: 'D', failure: 'F' })[s.type as 'warmup']).join(' ')}{/if}</span>
              </span>
              {#if editable}<Icon name={open === e.key ? 'up' : 'down'} size={18} />{/if}
            </button>
            {#if editable && open === e.key}
              <div class="steppers" data-nodrag transition:slide={{ duration: 260, easing: cubicOut }}>
                <SetPlanEditor bind:sets={e.sets} onchange={() => planChanged(e)} />
              </div>
            {/if}
          </div>
        {/snippet}
      </SortableRows>
      {#if editable}
        <p class="hint muted">Mantén pulsado para mover · desliza a la derecha para eliminar · a la izquierda para reemplazar</p>
      {/if}
    {/if}

    {#if editable && (dirty || saved)}
      <div class="savebar">
        {#if saved}<span class="ok"><Icon name="check" size={16} /> Guardado</span>{/if}
        {#if dirty}<button class="primary" disabled={busy || !name.trim()} onclick={save}>Guardar rutina</button>{/if}
      </div>
    {/if}
  {/if}
</main>

{#if picker}
  <ExercisePicker
    exercises={library}
    title={picker.mode === 'replace' ? `Reemplazar ${picker.target.exerciseName}` : 'Añadir ejercicio'}
    onpick={pick}
    onclose={() => (picker = null)}
  />
{/if}
{#if removed}
  <UndoToast message={`${removed.item.exerciseName} eliminado`} onundo={undo} ondismiss={() => (removed = null)} />
{/if}

<style>
  .title {
    width: 100%;
    margin-top: 0.25rem;
    min-height: 48px;
    font-weight: 600;
    font-size: var(--t-xl);
    letter-spacing: -0.015em;
  }
  .focus {
    width: 100%;
    margin-top: 0.5rem;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .head h2 {
    margin: 1.25rem 0 0.5rem;
  }
  .add {
    width: 36px;
    min-height: 36px;
    border-radius: 50%;
    color: var(--accent);
  }
  .ex {
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
  .head-row {
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.4rem 0.75rem 0.4rem 0.45rem;
    border-radius: var(--radius);
    background: none;
    box-shadow: none;
    text-align: left;
    color: var(--text);
    font-weight: 400;
  }
  .head-row > :global(svg) {
    flex: none;
    color: var(--faint);
  }
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 40px;
    height: 44px;
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.1rem;
  }
  .grow strong {
    font-size: var(--t-md);
    font-weight: 550;
    line-height: 1.25;
  }
  .grow .muted {
    font-size: var(--t-sm);
  }
  .steppers {
    padding: 0.75rem;
    border-top: 1px solid var(--line);
  }
  .hint {
    margin: 0.75rem 0 0;
    font-size: var(--t-xs);
    text-align: center;
  }
  .empty {
    text-align: center;
  }
  .savebar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1.25rem 1rem calc(0.9rem + env(safe-area-inset-bottom));
    display: grid;
    gap: 0.4rem;
    justify-items: center;
    background: linear-gradient(180deg, transparent, var(--bg) 60%);
    pointer-events: none;
  }
  .savebar > * {
    pointer-events: auto;
  }
  .savebar .ok {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--t-sm);
  }
  .savebar .primary {
    max-width: 22rem;
    min-height: 44px;
    margin-top: 0;
  }
</style>
