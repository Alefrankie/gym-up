<script lang="ts">
  import { untrack } from 'svelte';
  import { t, tn } from '#lib/i18n';
  import type { WorkoutView } from '#lib/offline/workout-view.svelte';
  import { bodyWeightKg, estimateKcal, formatDuration, restStats, saveBodyWeightKg } from '#lib/workout-math';
  import Icon from './Icon.svelte';
  import SessionStats from './SessionStats.svelte';
  import Sheet from './Sheet.svelte';

  /**
   * Last stop before saving a workout: warns about sets left undone, lets the real duration be set
   * (past days and forgotten timers) and shows what the session added up to, calories included.
   */
  let { view, onclose }: { view: WorkoutView; onclose: () => void } = $props();

  const d = untrack(() => view.duration);
  let hours = $state(Math.floor(d.suggestedSeconds / 3600));
  let minutes = $state(Math.round((d.suggestedSeconds % 3600) / 60));
  let bodyKg = $state(bodyWeightKg());

  const seconds = $derived(Math.max(0, (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60));
  const rows = $derived(Object.values(view.snap?.rows ?? {}).filter((r) => r.completed));
  const volume = $derived(Math.round(rows.reduce((n, r) => n + r.reps * r.weight, 0)));
  const kcal = $derived(estimateKcal(seconds, Number(bodyKg) || 75));
  const fmt = formatDuration;

  function useClock() {
    if (d.clockSeconds == null) return;
    hours = Math.floor(d.clockSeconds / 3600);
    minutes = Math.round((d.clockSeconds % 3600) / 60);
  }

  async function save() {
    void saveBodyWeightKg(Number(bodyKg) || 75);
    // The clock as it is needs no correction; anything else is sent as the real duration.
    const changed = d.clockSeconds == null || Math.abs(seconds - d.clockSeconds) > 60;
    if (await view.finish(changed ? Math.max(60, seconds) : undefined)) onclose();
  }
</script>

<Sheet title={t('workout.finish')} {onclose}>
  {#if view.pendingSets > 0}
    <p class="warn" role="alert">
      <Icon name="alert" size={18} />
      <span>{tn('finish.pending', view.pendingSets)}</span>
    </p>
  {/if}

  <section>
    <h3>{t('finish.duration')}</h3>
    {#if d.clockSeconds == null}
      <p class="muted hint">{t('finish.pastDay')}</p>
    {:else if d.doubtful}
      <p class="muted hint">{t('finish.forgot', { clock: fmt(d.clockSeconds), suggested: fmt(d.suggestedSeconds) })}</p>
    {/if}
    <div class="time">
      <label><input type="number" inputmode="numeric" min="0" max="6" bind:value={hours} /><span>h</span></label>
      <label><input type="number" inputmode="numeric" min="0" max="59" step="5" bind:value={minutes} /><span>min</span></label>
      {#if d.doubtful && d.clockSeconds != null}
        <button type="button" class="chip" onclick={useClock}>{t('finish.useClock', { clock: fmt(d.clockSeconds) })}</button>
      {/if}
    </div>
  </section>

  <SessionStats {seconds} sets={rows.length} {volume} unit={view.unit} {kcal} records={view.records} rest={restStats(rows.map((r) => r.doneAt))} />
  <label class="body muted">
    {t('finish.bodyWeight')}
    <input type="number" inputmode="decimal" min="30" max="250" bind:value={bodyKg} />
    kg
  </label>

  {#if view.error}<p class="error" role="alert">{view.error}</p>{/if}
  <button class="primary" disabled={view.finishing || seconds < 60} onclick={save}>
    <Icon name="check" size={18} /> {view.finishing ? t('workout.finishing') : t('finish.save')}
  </button>
</Sheet>

<style>
  .warn {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    margin: 0 0 1rem;
    padding: 0.75rem 0.9rem;
    border-radius: var(--radius);
    background: var(--surface-hi);
    color: var(--ember);
    line-height: 1.4;
  }
  .warn span {
    color: var(--text);
  }
  h3 {
    margin: 0 0 0.3rem;
    font-size: var(--t-sm);
    color: var(--muted);
    font-weight: 500;
  }
  .hint {
    margin: 0 0 0.5rem;
    font-size: var(--t-sm);
    line-height: 1.4;
  }
  .time {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .time label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .time input {
    width: 4.5rem;
    min-height: 48px;
    text-align: center;
    font-size: var(--t-lg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .chip {
    min-height: 40px;
    padding: 0.3rem 0.8rem;
    border-radius: 999px;
    font-size: var(--t-sm);
  }
  .body {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0 0 1rem;
    font-size: var(--t-xs);
  }
  .body input {
    width: 4rem;
    min-height: 36px;
    padding: 0.2rem 0.4rem;
    text-align: center;
    font-size: var(--t-sm);
  }
  .primary {
    width: 100%;
  }
</style>
