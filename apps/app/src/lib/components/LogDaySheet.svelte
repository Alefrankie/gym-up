<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { programDetailDtoSchema, programListResponseSchema, type ProgramDetailDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { localDay, longDate } from '#lib/dates';
  import { t, tn } from '#lib/i18n';
  import { cachedGet } from '#lib/offline/cache';
  import { startRoutine } from '#lib/offline/start-workout';
  import { estimateMinutes } from '#lib/workout-math';
  import ProgramThumb from './ProgramThumb.svelte';
  import Sheet from './Sheet.svelte';

  /**
   * "What did you do on Monday?": pick one routine of the active program and log it for `day`.
   * The workout then opens with the routine's plan, to be adjusted to what was really done that day.
   */
  let { day, onclose }: { day: string; onclose: () => void } = $props();

  let program = $state<ProgramDetailDto | null>(null);
  let error = $state<string | null>(null);
  let busy = $state<string | null>(null);

  onMount(async () => {
    try {
      const list = (await cachedGet('/programs', programListResponseSchema)).data;
      if (!list.activeProgramId) {
        error = t('logDay.noProgram');
        return;
      }
      program = (await cachedGet(`/programs/${list.activeProgramId}`, programDetailDtoSchema, { onCached: (c) => (program = c.data) })).data;
    } catch {
      error = t('logDay.loadError');
    }
  });

  async function pick(routineId: string, name: string) {
    busy = routineId;
    error = null;
    try {
      // Today is a normal live workout (with its timer); any other day is logged for that date.
      const out = await startRoutine(routineId, (current) => confirm(t('routine.replaceConfirm', { current, name })), day === localDay() ? undefined : day);
      if (out.kind === 'started') {
        onclose();
        await goto(`/workout/${out.workoutId}`);
        return;
      }
      if (out.kind === 'missing') error = t('logDay.loadError');
    } catch (e) {
      error = e instanceof NetworkError ? t('routine.startOffline') : e instanceof ApiRequestError ? e.message : t('logDay.loadError');
    }
    busy = null;
  }
</script>

<Sheet title={t('logDay.title', { day: longDate(new Date(`${day}T12:00:00`)) })} {onclose}>
  <p class="muted hint">{t('logDay.hint')}</p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if program}
    <ul class="routines">
      {#each program.routines.filter((r) => r.exercises.length) as r (r.id)}
        <li>
          <button type="button" class="routine" disabled={busy !== null} onclick={() => pick(r.id, r.name)}>
            <ProgramThumb muscles={[...new Set(r.exercises.map((e) => e.muscleGroup))]} size={44} />
            <span class="grow">
              <strong>{r.name}</strong>
              <span class="muted">{r.focus ? `${r.focus} · ` : ''}{tn('workout.exerciseCount', r.exercises.length)} · ≈ {estimateMinutes(r.exercises)} min</span>
            </span>
            {#if busy === r.id}<span class="spinner" aria-hidden="true"></span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {:else if !error}
    <p class="muted loading">{t('common.loading')}</p>
  {/if}
</Sheet>

<style>
  .hint {
    margin: -0.25rem 0 1rem;
    font-size: var(--t-sm);
  }
  .routines {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }
  .routine {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 64px;
    padding: 0.5rem 0.75rem 0.5rem 0.5rem;
    border-radius: var(--radius);
    background: var(--surface-hi);
    box-shadow: none;
    text-align: left;
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
  }
  .grow strong {
    font-weight: 600;
  }
  .grow .muted {
    font-size: var(--t-sm);
    font-weight: 400;
  }
  .spinner {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--accent);
    border-right-color: transparent;
    animation: spin 700ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
