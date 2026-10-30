<script lang="ts">
  import { t, tn } from '#lib/i18n';
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
  import SaveBar from '#lib/components/SaveBar.svelte';
  import UndoToast from '#lib/components/UndoToast.svelte';
  import { goto } from '$app/navigation';
  import { startRoutine } from '#lib/offline/start-workout';

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
  // What was last loaded or saved; the save bar shows only when the routine really differs from it.
  let baseline = $state('');
  const fingerprint = () =>
    JSON.stringify({ name: name.trim(), focus: focus.trim(), exercises: exercises.map((e) => [e.exerciseId, e.sets, e.restSeconds, e.notes]) });
  const dirty = $derived(!!baseline && fingerprint() !== baseline);
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
        baseline = fingerprint();
        return true;
      };
      const res = await cachedGet(`/programs/${programId}`, programDetailDtoSchema, { onCached: (c) => void show(c.data) });
      if (!show(res.data)) {
        error = t('routine.notFound');
        return;
      }
      if (res.stale) error = t('routine.staleReadOnly');
      if (!res.data.isTemplate) library = (await cachedGet('/exercises', libraryExerciseListResponseSchema)).data.items;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('routine.offline')
          : e instanceof ApiRequestError && e.status === 404
            ? t('programs.notFound')
            : t('routine.loadError');
    }
  });

  const touch = () => {
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
      baseline = fingerprint();
      await invalidateCache(['/programs', '/workouts/today']);
      saved = true;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('routine.saveOffline')
          : e instanceof ApiRequestError
            ? e.message
            : t('programs.saveError');
    }
    busy = false;
  }

  let starting = $state(false);

  /** Starts this routine today, whatever the rotation says; opens its first exercise. */
  async function start() {
    starting = true;
    error = null;
    try {
      const out = await startRoutine(routineId, (n) => confirm(t('routine.replaceConfirm', { current: n, name })));
      if (out.kind === 'started') {
        await goto(out.firstExerciseId ? `/workout/${out.workoutId}/${out.firstExerciseId}` : `/workout/${out.workoutId}`);
        return;
      }
      if (out.kind === 'missing') error = t('routine.loadError');
    } catch (e) {
      error = e instanceof NetworkError ? t('routine.startOffline') : e instanceof ApiRequestError ? e.message : t('routine.startError');
    }
    starting = false;
  }
</script>

<main>
  <p><a class="back" href={`/programs/${programId}`}><Icon name="left" size={16} /> {detail?.name ?? t('routine.program')}</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !detail && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if detail}
    {#if editable}
      <input class="title-input" maxlength="60" aria-label={t('routine.name')} placeholder={t('routine.name')} bind:value={name} oninput={touch} />
      <input class="focus" maxlength="80" aria-label={t('routine.focus')} placeholder={t('routine.focusPlaceholder')} bind:value={focus} oninput={touch} />
    {:else}
      <h1>{name}</h1>
      <p class="muted">{focus}</p>
    {/if}

    {#if exercises.length}
      <TargetMuscles muscles={muscleLoad(exercises)} />
    {/if}

    <div class="head">
      <h2>{tn('programs.exercises', exercises.length)}</h2>
      {#if editable}
        <button class="icon add" onclick={() => (picker = { mode: 'add' })} disabled={exercises.length >= PROGRAM_LIMITS.exercises} aria-label={t('routine.addExercise')}>
          <Icon name="plus" size={18} />
        </button>
      {/if}
    </div>

    {#if exercises.length === 0}
      <section class="card empty">
        <p>{t('routine.empty')}</p>
        {#if editable}<button class="primary" onclick={() => (picker = { mode: 'add' })}>{t('routine.addFirst')}</button>{/if}
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
                <span class="muted">{muscle(e.muscleGroup)} · {tn('routine.sets', e.targetSets)} · {t('routine.reps', { n: e.targetReps })}{#if e.sets.some((s) => s.type !== 'normal')} · {e.sets.filter((s) => s.type !== 'normal').map((s) => ({ warmup: t('plan.short.warmup'), drop: t('plan.short.drop'), failure: t('plan.short.failure') })[s.type as 'warmup']).join(' ')}{/if}</span>
              </span>
              {#if editable}<Icon name={open === e.key ? 'up' : 'down'} size={18} />{/if}
            </button>
            {#if editable && open === e.key}
              <div class="steppers" data-nodrag transition:slide={{ duration: 260, easing: cubicOut }}>
                <SetPlanEditor bind:sets={e.sets} unit={session.user?.weightUnit ?? 'kg'} onchange={() => planChanged(e)} />
              </div>
            {/if}
          </div>
        {/snippet}
      </SortableRows>
      {#if editable}
        <p class="hint muted">{t('routine.hint')}</p>
      {/if}
    {/if}

  {/if}
</main>

{#if detail && editable}
  <SaveBar {dirty} {saved} {busy} disabled={!name.trim()} label={t('routine.save')} onsave={save}>
    {#snippet idle()}
      {#if exercises.length}
        <button class="primary go" disabled={starting} onclick={start}><Icon name="bolt" size={16} /> {starting ? t('routine.starting') : t('routine.start')}</button>
      {/if}
    {/snippet}
  </SaveBar>
{/if}

{#if picker}
  <ExercisePicker
    exercises={library}
    title={picker.mode === 'replace' ? t('routine.replace', { name: picker.target.exerciseName }) : t('routine.addExercise')}
    onpick={pick}
    onclose={() => (picker = null)}
  />
{/if}
{#if removed}
  <UndoToast message={t('programs.removed', { name: removed.item.exerciseName })} onundo={undo} ondismiss={() => (removed = null)} />
{/if}

<style>
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
</style>
