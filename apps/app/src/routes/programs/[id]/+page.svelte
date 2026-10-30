<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { PROGRAM_LIMITS, programDetailDtoSchema, programListResponseSchema, type ProgramDetailDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { muscleLoad } from '#lib/muscle-load';
  import { muscle } from '#lib/labels';
  import { saveBody } from '#lib/programs';
  import { estimateMinutes, totalSets } from '#lib/workout-math';
  import { session } from '#lib/session';
  import BarList from '#lib/components/BarList.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import ProgramThumb from '#lib/components/ProgramThumb.svelte';
  import SaveBar from '#lib/components/SaveBar.svelte';
  import SortableRows from '#lib/components/SortableRows.svelte';
  import TargetMuscles from '#lib/components/TargetMuscles.svelte';
  import UndoToast from '#lib/components/UndoToast.svelte';

  type RoutineDto = ProgramDetailDto['routines'][number];

  const id = $derived(page.params.id ?? '');
  let program = $state<ProgramDetailDto | null>(null);
  let activeId = $state<string | null>(null);
  let name = $state('');
  let routines = $state<RoutineDto[]>([]);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let saved = $state(false);
  let removed = $state<{ item: RoutineDto; index: number } | null>(null);

  const editable = $derived(!!program && !program.isTemplate);
  const isActive = $derived(!!program && activeId === program.id);

  // What was last loaded or saved; the save bar appears only when name or day order really differ from it.
  let baseline = $state('');
  const fingerprint = () => JSON.stringify([name.trim(), routines.map((r) => r.id)]);
  const dirty = $derived(!!baseline && fingerprint() !== baseline);

  function show(d: ProgramDetailDto) {
    program = d;
    name = d.name;
    routines = [...d.routines];
    baseline = fingerprint();
  }

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      show((await cachedGet(`/programs/${id}`, programDetailDtoSchema, { onCached: (c) => show(c.data) })).data);
      activeId = (await cachedGet('/programs', programListResponseSchema, { onCached: (c) => (activeId = c.data.activeProgramId) })).data.activeProgramId;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('programs.offlineNotSaved')
          : e instanceof ApiRequestError && e.status === 404
            ? t('programs.notFound')
            : t('programs.loadOneError');
    }
  });

  const allExercises = $derived(routines.flatMap((r) => r.exercises));
  const setsTotal = $derived(totalSets(allExercises));
  /** Planned working sets per muscle in one full rotation (primary muscle only), most first. */
  const perMuscle = $derived.by(() => {
    const m = new Map<string, number>();
    for (const e of allExercises) m.set(e.muscleGroup, (m.get(e.muscleGroup) ?? 0) + e.targetSets);
    return [...m].sort((a, b) => b[1] - a[1]);
  });
  const setsPerMuscle = $derived(perMuscle.map(([k, v]) => ({ label: muscle(k), value: v })));
  const routineMuscles = (r: RoutineDto) => [...new Set(r.exercises.map((e) => e.muscleGroup))];

  function remove(item: RoutineDto) {
    const index = routines.findIndex((r) => r.id === item.id);
    if (index < 0) return;
    routines.splice(index, 1);
    removed = { item, index };
    saved = false;
  }

  function undo() {
    if (!removed) return;
    routines.splice(removed.index, 0, removed.item);
    removed = null;
  }

  async function persist(): Promise<boolean> {
    if (!program) return false;
    busy = true;
    error = null;
    try {
      show(
        await api(`/programs/${id}`, {
          method: 'PUT',
          body: saveBody(program, { name: name.trim() || program.name, routines }),
          schema: programDetailDtoSchema,
        }),
      );
      await invalidateCache(['/programs', '/workouts/today']);
      saved = true;
      return true;
    } catch (e) {
      error = e instanceof NetworkError ? t('programs.saveOffline') : e instanceof ApiRequestError ? e.message : t('programs.saveError');
      return false;
    } finally {
      busy = false;
    }
  }

  /** A new day is saved right away so its editor can load it from the server. */
  async function addRoutine() {
    if (!program || routines.length >= PROGRAM_LIMITS.routines) return;
    const fresh: RoutineDto = { id: crypto.randomUUID(), dayNumber: routines.length + 1, name: t('programs.dayN', { n: routines.length + 1 }), focus: '', notes: null, exercises: [] };
    routines.push(fresh);
    if (await persist()) await goto(`/programs/${id}/${fresh.id}`);
    else routines.pop();
  }

  async function act(fn: () => Promise<unknown>, fallback: string) {
    busy = true;
    error = null;
    try {
      await fn();
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : fallback;
    }
    busy = false;
  }

  const activate = () =>
    act(async () => {
      await api(`/programs/${id}/activate`, { method: 'POST' });
      await invalidateCache(['/programs', '/workouts/today']);
      activeId = id;
    }, t('programs.activateOffline'));

  const adopt = () =>
    act(async () => {
      const copy = await api<ProgramDetailDto>(`/programs/${id}/adopt`, { method: 'POST', schema: programDetailDtoSchema });
      await invalidateCache(['/programs', '/workouts/today']);
      await goto(`/programs/${copy.id}`);
    }, t('programs.adoptOffline'));

  async function archive() {
    if (!confirm(t('programs.archiveConfirm'))) return;
    await act(async () => {
      await api(`/programs/${id}`, { method: 'DELETE' });
      await invalidateCache(['/programs', '/workouts/today']);
      await goto('/programs');
    }, t('programs.archiveError'));
  }
</script>

<main>
  <p><a class="back" href="/programs"><Icon name="left" size={16} /> {t('nav.train')}</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !program && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if program}
    <header class="hero">
      <ProgramThumb muscles={perMuscle.map(([k]) => k)} size={72} />
      <div class="hero-text">
        {#if editable}
          <input class="title-input" maxlength="60" aria-label={t('programs.nameLabel')} bind:value={name} oninput={() => (saved = false)} />
        {:else}
          <h1>{program.name}</h1>
        {/if}
        {#if isActive}
          <span class="active"><span class="dot"></span>{t('programs.active')}</span>
        {:else if editable && routines.length > 0}
          <button type="button" class="ghost activate" disabled={busy} onclick={activate}>{t('programs.makeActive')}</button>
        {:else if program.description}
          <span class="muted desc">{program.description}</span>
        {/if}
      </div>
    </header>

    <div class="stats">
      <div><strong>{routines.length}</strong><span>{tn('programs.dayWord', routines.length)}</span></div>
      <div><strong>{allExercises.length}</strong><span>{tn('programs.exerciseWord', allExercises.length)}</span></div>
      <div><strong>{setsTotal}</strong><span>{t('programs.setsPerWeek')}</span></div>
    </div>

    {#if allExercises.length}
      <TargetMuscles muscles={muscleLoad(allExercises)} />
    {/if}

    <div class="head">
      <h2>{t('programs.daysTitle')}</h2>
      {#if editable}
        <button class="icon add" onclick={addRoutine} disabled={busy || routines.length >= PROGRAM_LIMITS.routines} aria-label={t('programs.addDay')}>
          <Icon name="plus" size={18} />
        </button>
      {/if}
    </div>

    {#if routines.length === 0}
      <button type="button" class="empty" disabled={!editable} onclick={addRoutine}><Icon name="plus" size={18} /> {t('programs.addFirstDay')}</button>
    {:else}
      <SortableRows items={routines} key={(r) => r.id} disabled={!editable} onreorder={(next) => ((routines = next), (saved = false))} onremove={editable ? remove : undefined}>
        {#snippet row(r, i)}
          <a class="day" href={`/programs/${id}/${r.id}`}>
            <span class="num">{i + 1}</span>
            <span class="grow">
              <strong>{r.name}</strong>
              <span class="muted">
                {#if r.exercises.length}
                  {r.focus ? `${r.focus} · ` : ''}{tn('programs.exercises', r.exercises.length)} · ≈ {t('programs.minutes', { n: estimateMinutes(r.exercises) })}
                {:else}
                  {t('programs.noExercisesYet')}
                {/if}
              </span>
            </span>
            <ProgramThumb muscles={routineMuscles(r)} size={44} />
          </a>
        {/snippet}
      </SortableRows>
      {#if editable}
        <p class="hint muted">{t('programs.daysHint')}</p>
      {/if}
    {/if}

    {#if setsPerMuscle.length}
      <section class="card chart">
        <h2 class="first">{t('programs.setsPerMuscle')}</h2>
        <p class="muted sub">{t('programs.setsPerMuscleSub')}</p>
        <BarList items={setsPerMuscle} />
      </section>
    {/if}

    {#if editable}
      <p class="archive"><button class="ghost danger-text" disabled={busy} onclick={archive}><Icon name="trash" size={16} /> {t('programs.archive')}</button></p>
    {/if}
  {/if}
</main>

{#if program && !program.isTemplate}
  <SaveBar {dirty} {saved} {busy} disabled={!name.trim()} onsave={persist} />
{:else if program}
  <SaveBar dirty={false} saved={false} onsave={() => {}}>
    {#snippet idle()}
      <button class="primary" disabled={busy} onclick={adopt}>{t('programs.useThis')}</button>
    {/snippet}
  </SaveBar>
{/if}

{#if removed}
  <UndoToast message={t('programs.removed', { name: removed.item.name })} onundo={undo} ondismiss={() => (removed = null)} />
{/if}

<style>
  .hero {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0.25rem 0 1rem;
  }
  .hero-text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.3rem;
    justify-items: start;
  }
  .hero h1 {
    margin: 0;
  }
  .desc {
    font-size: var(--t-sm);
  }
  .active {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--accent-hi);
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
  }
  .activate {
    min-height: 32px;
    padding: 0 0.6rem;
    margin-left: -0.6rem;
    color: var(--accent-hi);
    font-size: var(--t-sm);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .stats div {
    display: grid;
    gap: 0.1rem;
    padding: 0.75rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
  .stats strong {
    font-family: var(--font-display);
    font-size: var(--t-xl);
    font-weight: 700;
    line-height: 1.1;
  }
  .stats span {
    color: var(--muted);
    font-size: var(--t-xs);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .add {
    width: 40px;
    min-height: 40px;
    border-radius: 50%;
    color: var(--accent-hi);
  }
  .day {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    min-height: 72px;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    color: var(--text);
    text-decoration: none;
  }
  .num {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--surface-hi);
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 650;
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.15rem;
  }
  .grow strong {
    font-weight: 600;
  }
  .grow .muted {
    font-size: var(--t-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    margin: 0.75rem 0 0;
    font-size: var(--t-xs);
    text-align: center;
  }
  .empty {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 56px;
    background: none;
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--muted);
  }
  .chart {
    margin-top: 1.5rem;
  }
  .first {
    margin: 0;
  }
  .sub {
    margin: 0.2rem 0 1rem;
    font-size: var(--t-sm);
  }
  .archive {
    margin: 1.5rem 0 5rem;
  }
  .danger-text {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--danger);
    font-size: var(--t-sm);
  }
</style>
