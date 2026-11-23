<script lang="ts">
  import { exerciseName } from '#lib/exercise-name';
  import FinishSheet from '#lib/components/FinishSheet.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { muscle } from '#lib/labels';
  import { REST_SECONDS } from '#lib/offline/rest.svelte';
  import { useWorkoutView } from '#lib/offline/workout-context';
  import { MAX_DROPS, toDisplay } from '#lib/offline/workout-view.svelte';
  import type { SetType } from '@gym-up/contracts';
  import { t, tn } from '#lib/i18n';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';
  import NudgeToast from '#lib/components/NudgeToast.svelte';
  import RestCountdown from '#lib/components/RestCountdown.svelte';
  import SetTypeBadge from '#lib/components/SetTypeBadge.svelte';
  import { SET_TYPES, setTypeOf } from '#lib/set-types';
  import SortableRows from '#lib/components/SortableRows.svelte';

  const view = useWorkoutView();
  let finishing = $state(false);
  const id = $derived(page.params.id ?? '');
  const exercises = $derived(view.snap?.exercises ?? []);
  const index = $derived(exercises.findIndex((e) => e.exerciseId === page.params.exercise));
  const ex = $derived(index >= 0 ? exercises[index]! : null);
  const isLast = $derived(index === exercises.length - 1);
  const active = $derived(ex ? view.activeSet(ex) : null);
  // Bodyweight exercises load the body, not the bar: the number in the box is the added weight only.
  const bodyweight = $derived(!!ex && view.isBodyweight(ex));
  const bodyWeight = $derived(ex ? view.bodyWeight(ex) : null);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const ago = (iso: string) => {
    const days = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));
    return days === 0 ? t('common.today') : days === 1 ? t('common.yesterday') : tn('workout.daysAgo', days);
  };

  function removeSet(n: number) {
    if (!ex) return;
    const r = view.row(ex.exerciseId, n);
    if (!r?.completed || confirm(t('workout.removeSetConfirm', { n }))) void view.removeSet(ex, n);
  }

  // The kind of set is chosen when the set is added; tapping a set's number marks it done.
  let adding = $state(false);
  let addRoot = $state<HTMLElement>();

  async function addSet(type: SetType) {
    adding = false;
    if (!ex) return;
    await view.addSet(ex);
    const nums = view.setNumbers(ex);
    if (type !== 'normal') await view.retype(ex.exerciseId, nums[nums.length - 1]!, type);
  }

  function go(delta: number) {
    const next = exercises[index + delta];
    if (next) void goto(`/workout/${id}/${next.exerciseId}`, { replaceState: true });
    else void goto(`/workout/${id}`);
  }
</script>


<svelte:window onpointerdown={(e) => adding && addRoot && !addRoot.contains(e.target as Node) && (adding = false)} />

{#if !ex}
  <p class="muted">{t('workout.notInWorkout')}</p>
  <p><a class="back" href={`/workout/${id}`}><Icon name="left" size={18} /> {t('workout.backToRoutine')}</a></p>
{:else}
  <section class="hero" aria-label={exerciseName(ex.exerciseName)}>
    <a class="round back-btn" href={`/workout/${id}`} aria-label={t('workout.backToRoutine')}><Icon name="left" size={20} /></a>
    {#if view.elapsed}
      <span class="elapsed" role="timer" aria-label={t('workout.elapsed')}><Icon name="timer" size={14} />{view.elapsed}</span>
    {/if}
    <NudgeToast workout />
    <div class="figs">
      <MuscleFigure primary={ex.muscleGroup} secondary={ex.secondaryMuscles ?? []} view="both" size={60} />
    </div>
    <div class="title">
      <span class="count">{t('workout.exerciseOf', { n: index + 1, total: exercises.length })}</span>
      <h1>{exerciseName(ex.exerciseName)}</h1>
    </div>
  </section>

  <div class="pills">
    <span class="chip"><Icon name="timer" size={14} />{mmss(ex.restSeconds ?? REST_SECONDS)}</span>
    <span class="chip">{muscle(ex.muscleGroup)}</span>
    {#if bodyweight}
      {#if bodyWeight}
        <span class="chip on">{t('workout.bodyWeight')}: {bodyWeight} {view.unit}</span>
      {:else}
        <a class="chip link" href="/settings">{t('workout.bodyWeightUnset')}</a>
      {/if}
    {/if}
    {#if ex.last}
      <span class="chip on"><Icon name="history" size={14} />{ago(ex.last.date)}: {toDisplay(ex.last.weight, view.unit)} {view.unit} × {ex.last.reps}</span>
      {#if ex.last.record}<span class="chip record"><Icon name="flame" size={14} />{t('workout.record')}: {toDisplay(ex.last.record.weight, view.unit)} {view.unit} × {ex.last.record.reps}</span>{/if}
    {:else}
      <span class="chip">{t('workout.firstTime')}</span>
    {/if}
    <a class="chip link" href={`/library/${ex.exerciseId}`}><Icon name="book" size={14} />{t('workout.howTo')}</a>
  </div>

  <div class="sets-heading">
    <h2>{t('workout.sets')}</h2>
  </div>
  <div class="table" role="group" aria-label={t('workout.sets')}>
    <div class="heads">
      <span>{t('workout.set')}</span>
      <span>{t('workout.reps')}</span>
      <span>{bodyweight ? `${t('workout.addedWeight')} (${view.unit})` : view.unit.toUpperCase()}</span>
    </div>
    <SortableRows
      items={view.setNumbers(ex).map((n) => ({ n, id: view.row(ex.exerciseId, n)?.id ?? `${n}` }))}
      key={(s) => s.id}
      disabled={view.isCompleted}
      onreorder={(next) => view.reorderSets(ex, next.map((s) => s.n))}
      onremove={view.isCompleted || view.setNumbers(ex).length <= 1 ? undefined : (s) => removeSet(s.n)}
    >
      {#snippet row({ n })}
      {@const r = view.row(ex.exerciseId, n)}
      {#if r}
        <div class="set" class:done={r.completed} class:active={active === n}>
          <button
            type="button"
            class="mark st-{r.type ?? 'normal'}"
            disabled={view.isCompleted}
            onclick={() => view.commit(ex.exerciseId, n, !r.completed)}
            aria-label={r.completed ? t('workout.uncheckSet', { n }) : t('workout.checkSet', { n })}
          >{#if r.completed}<Icon name="check" size={20} />{:else}{setTypeOf(r.type).short || view.displaySetNumber(ex, n)}{/if}</button>
          <input
            type="text"
            inputmode="numeric"
            value={r.reps}
            onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
            oninput={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              const value = Number(input.value);
              if (input.value !== '' && Number.isInteger(value) && value >= 1 && value <= 100) r.reps = value;
            }}
            onblur={(e) => {
              const input = e.currentTarget as HTMLInputElement;
              const value = Number(input.value);
              if (!Number.isInteger(value) || value < 1 || value > 100) input.value = String(r.reps);
            }}
            disabled={view.isCompleted}
            onchange={() => view.edited(ex.exerciseId, n)}
            aria-label={t('workout.setReps', { n })}
          />
          <input
            type="text"
            inputmode="decimal"
            value={r.weight}
            onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
            disabled={view.isCompleted}
            onchange={(e) => {
              const input = e.currentTarget;
              const raw = input.value.trim().replace(',', '.');
              const weight = Number(raw);
              if (!raw || !Number.isFinite(weight) || weight < 0) {
                input.value = String(r.weight);
                return;
              }
              if (r.weight === weight) return;
              r.weight = weight;
              view.weightChanged(ex, n);
              view.edited(ex.exerciseId, n);
            }}
            aria-label={bodyweight ? t('workout.setAddedWeight', { n, unit: view.unit }) : t('workout.setWeight', { n, unit: view.unit })}
          />
        </div>
        {#if r.type === 'drop'}
          {#each r.drops ?? [] as d, i (d.id)}
            <div class="set drop" class:done={d.completed}>
              {#if view.isCompleted}
                <span class="drop-mark" aria-hidden="true">↳</span>
              {:else}
                <button type="button" class="drop-mark" onclick={() => view.removeDrop(ex, n, i)} aria-label={t('workout.removeDrop', { n, i: i + 1 })}>↳<Icon name="x" size={12} /></button>
              {/if}
              <input
                type="text"
                inputmode="numeric"
                value={d.reps}
                onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
                oninput={(e) => {
                  const value = Number((e.currentTarget as HTMLInputElement).value);
                  if (Number.isInteger(value) && value >= 1 && value <= 100) d.reps = value;
                }}
                onblur={(e) => ((e.currentTarget as HTMLInputElement).value = String(d.reps))}
                disabled={view.isCompleted}
                onchange={() => view.editedDrop(ex, n, i)}
                aria-label={t('workout.dropReps', { n, i: i + 1 })}
              />
              <input
                type="text"
                inputmode="decimal"
                value={d.weight}
                onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
                oninput={(e) => {
                  const raw = (e.currentTarget as HTMLInputElement).value.replace(',', '.');
                  const value = Number(raw);
                  if (raw !== '' && Number.isFinite(value) && value >= 0) d.weight = value;
                }}
                onblur={(e) => ((e.currentTarget as HTMLInputElement).value = String(d.weight))}
                disabled={view.isCompleted}
                onchange={() => view.editedDrop(ex, n, i)}
                aria-label={t('workout.dropWeight', { n, i: i + 1, unit: view.unit })}
              />
              <button
                type="button"
                class="check"
                disabled={view.isCompleted}
                onclick={() => view.commitDrop(ex, n, i, !d.completed)}
                aria-label={d.completed ? t('workout.uncheckDrop', { n, i: i + 1 }) : t('workout.checkDrop', { n, i: i + 1 })}
              ><Icon name="check" size={18} /></button>
            </div>
          {/each}
          {#if !view.isCompleted && (r.drops?.length ?? 0) < MAX_DROPS}
            <button type="button" class="adddrop" onclick={() => view.addDrop(ex, n)}><Icon name="plus" size={14} /> {t('workout.addDrop')}</button>
          {/if}
        {/if}
      {/if}
      {/snippet}
    </SortableRows>
    {#if !view.isCompleted}
      <div class="addwrap" bind:this={addRoot}>
        <button type="button" class="addset" aria-haspopup="menu" aria-expanded={adding} onclick={() => (adding = !adding)}><Icon name="plus" size={16} /> {t('workout.addSet')}</button>
        {#if adding}
          <div class="addmenu" role="menu">
            {#each SET_TYPES as o (o.value)}
              <button type="button" role="menuitem" onclick={() => addSet(o.value)}>
                <SetTypeBadge type={o.value} n={view.setNumbers(ex).length + 1} size="md" />
                <span class="text"><strong>{o.label}</strong><small>{o.hint}</small></span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if ex.last?.sets?.length}
    <a class="last" href={`/progress?exercise=${encodeURIComponent(ex.exerciseId)}#exercise-history`} aria-label={`${t('workout.lastSession')} · ${t('progress.byExercise')}`}>
      <header>
        <strong>{t('workout.lastSession')}</strong>
        <span>{ago(ex.last.date)} <Icon name="right" size={16} /></span>
      </header>
      {#each ex.last.sets as s, i (i)}
        <div class="last-row">
          <span>{t('workout.set')} {i + 1}</span>
          <span>{toDisplay(s.weight, view.unit)} {view.unit}</span>
          <span>{s.reps} {t('workout.reps').toLowerCase()}</span>
        </div>
      {/each}
    </a>
  {/if}

  <div class="cta">
    <div class="dock"><RestCountdown /></div>
    <div class="pair">
      {#if isLast}
        <button type="button" class="round" disabled={index === 0} onclick={() => go(-1)} aria-label={t('workout.prevExercise')}><Icon name="left" size={20} /></button>
        <button class="primary" disabled={view.finishing || !view.anyCompleted || view.isCompleted} onclick={() => (finishing = true)}>
          {view.finishing ? t('workout.finishingAlt') : t('workout.finishAlt')}
        </button>
      {:else}
        <button type="button" class="primary next" onclick={() => go(1)}>{t('workout.nextExercise')} <Icon name="right" size={18} /></button>
      {/if}
    </div>
  </div>
{/if}

{#if finishing}<FinishSheet {view} onclose={() => (finishing = false)} />{/if}

<style>
  .hero {
    position: relative;
    margin: -0.5rem -1rem 0;
    /* main already accounts for Android's safe area. */
    padding: 3.25rem 1rem 0.9rem;
    background: var(--surface);
    box-shadow: 0 1px 0 var(--line);
  }
  .round {
    display: grid;
    place-items: center;
    width: 40px;
    min-height: 40px;
    height: 40px;
    padding: 0;
    border-radius: 50%;
    color: var(--text);
  }
  a.round {
    background: var(--surface-hi);
    box-shadow: var(--shadow-card);
  }
  .back-btn {
    position: absolute;
    top: 0.5rem;
    left: 1rem;
  }
  .elapsed {
    position: absolute;
    top: calc(0.5rem + 6px);
    right: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 28px;
    padding: 0 0.6rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-hi);
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .figs {
    display: flex;
    justify-content: center;
    height: 6rem;
    overflow: hidden;
  }
  .title {
    margin-top: 0.5rem;
  }
  .count {
    color: var(--muted);
    font-size: var(--t-xs);
    font-weight: 500;
  }
  .title h1 {
    margin: 0.1rem 0 0;
    font-size: var(--t-lg);
  }
  .pills {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    margin: 0 -1rem;
    padding: 0.75rem 1rem 0;
    scrollbar-width: none;
  }
  .pills::-webkit-scrollbar {
    display: none;
  }
  .pills .chip {
    flex: none;
  }
  .pills .link {
    color: var(--text);
    text-decoration: none;
  }
  .table {
    display: grid;
    gap: 0.5rem;
  }
  .sets-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 1rem 0 0.65rem;
  }
  .sets-heading h2 {
    margin: 0;
  }
  .heads,
  .set {
    display: grid;
    grid-template-columns: 48px 1fr 1fr;
    gap: 0.5rem;
    align-items: center;
  }
  .set.drop {
    grid-template-columns: 48px 1fr 1fr 48px;
  }
  .mark {
    display: grid;
    place-items: center;
    min-height: 48px;
    padding: 0;
    background: var(--surface);
    color: var(--muted);
    font-weight: 600;
    transition: background 0.2s var(--ease), color 0.2s var(--ease);
  }
  .set.active .mark {
    box-shadow: 0 0 0 1px var(--accent) inset;
    color: var(--accent-hi);
  }
  .set.done .mark {
    background: var(--ok);
    box-shadow: none;
    color: #12220a;
  }
  .addwrap {
    position: relative;
    display: grid;
  }
  .addmenu {
    position: absolute;
    z-index: 20;
    bottom: calc(100% + 0.35rem);
    left: 0;
    width: 15.5rem;
    padding: 0.3rem;
    display: grid;
    gap: 0.1rem;
    border-radius: var(--radius);
    background: var(--surface-hi);
    box-shadow: var(--shadow-pop);
  }
  .addmenu button {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 44px;
    padding: 0.35rem 0.5rem;
    background: none;
    box-shadow: none;
    text-align: left;
    color: var(--text);
  }
  .addmenu button:active {
    background: var(--raised);
  }
  .addmenu .text {
    display: grid;
    line-height: 1.25;
  }
  .addmenu small {
    color: var(--muted);
    font-size: var(--t-xs);
  }
  .last {
    display: block;
    color: inherit;
    text-decoration: none;
    margin: 1.25rem 0 7rem;
    padding: 0.9rem 1rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
  .last header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5rem;
  }
  .last header span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--muted);
    font-size: var(--t-xs);
  }
  .last-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    padding: 0.35rem 0;
    color: var(--muted);
    font-size: var(--t-sm);
  }
  .last-row span:not(:first-child) {
    color: var(--text);
  }
  .heads {
    color: var(--faint);
    font-size: var(--t-xs);
    font-weight: 500;
    text-align: center;
  }
  .set input {
    min-height: 48px;
    padding: 0 0.5rem;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--t-lg);
  }
  .set.active input {
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .set.done input {
    box-shadow: 0 0 0 1px var(--ok) inset;
    color: var(--ok);
  }
  .check {
    display: grid;
    place-items: center;
    width: 48px;
    min-height: 48px;
    height: 48px;
    padding: 0;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--faint);
  }
  .set.done .check {
    background: var(--ok);
    box-shadow: none;
    color: #12220a;
  }
  .addset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 42px;
    background: none;
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .set.drop {
    margin-top: -0.25rem;
  }
  .set.drop input {
    min-height: 40px;
    font-size: var(--t-md);
  }
  .set.drop .check {
    justify-self: center;
    width: 40px;
    min-height: 40px;
    height: 40px;
  }
  .drop-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    min-height: 40px;
    padding: 0;
    background: none;
    box-shadow: none;
    color: var(--faint);
    font-size: var(--t-md);
  }
  .adddrop {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 36px;
    margin-left: calc(48px + 0.5rem);
    padding: 0 0.75rem;
    background: none;
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--muted);
    font-size: var(--t-xs);
    font-weight: 500;
  }
  .cta {
    position: fixed;
    z-index: 6;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, transparent, var(--bg) 45%);
    pointer-events: none;
  }
  .dock {
    max-width: 22rem;
    margin: 0 auto 0.5rem;
    pointer-events: auto;
  }
  .pair {
    display: flex;
    gap: 0.5rem;
    max-width: 22rem;
    margin: 0 auto;
    pointer-events: auto;
  }
  .pair .round {
    flex: none;
    background: var(--surface-hi);
    box-shadow: var(--shadow-card);
    width: 48px;
    height: 48px;
    min-height: 48px;
  }
  .pair .primary {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    margin-top: 0;
    min-height: 48px;
  }
  .pair .next {
    min-height: 52px;
    padding-inline: 1rem;
  }
  .record {
    color: var(--ember);
    box-shadow: 0 0 0 1px rgb(255 179 71 / 0.4) inset;
  }
</style>
