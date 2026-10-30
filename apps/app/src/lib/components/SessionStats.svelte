<script lang="ts">
  import { t } from '#lib/i18n';
  import { formatDuration, formatRest } from '#lib/workout-math';

  /**
   * What a session added up to, as one card of big coloured numbers: volume, calories, sets, records
   * and rest. Duration is included when the screen does not already show it large.
   */
  let {
    seconds = null,
    sets,
    volume,
    unit,
    kcal,
    records = null,
    rest = null,
  }: {
    seconds?: number | null;
    sets: number;
    volume: number;
    unit: string;
    kcal: number | null;
    records?: number | null;
    rest?: { avg: number; median: number } | null;
  } = $props();
</script>

<section class="stats">
  {#if seconds != null}
    <div><span class="k">{t('finish.duration')}</span><span class="v time">{formatDuration(seconds)}</span></div>
  {/if}
  <div><span class="k">{t('summary.volume')}</span><span class="v vol">{volume.toLocaleString()}<small>{unit}</small></span></div>
  <div><span class="k">{t('summary.energy')}</span><span class="v kcal">{kcal ? kcal : '—'}<small>kcal</small></span></div>
  <div><span class="k">{t('finish.sets')}</span><span class="v sets">{sets}</span></div>
  {#if records != null}
    <div><span class="k">{t('summary.records')}</span><span class="v rec">{records}</span></div>
  {/if}
  {#if rest}
    <div><span class="k">{t('summary.avgRest')}</span><span class="v rest">{formatRest(rest.avg)}</span></div>
    <div><span class="k">{t('summary.medianRest')}</span><span class="v rest">{formatRest(rest.median)}</span></div>
  {/if}
</section>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.1rem 1rem;
    margin: 1rem 0 0.5rem;
    padding: 1.1rem 1.25rem;
    border-radius: 22px;
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
  .stats div {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  .k {
    color: var(--text);
    font-size: var(--t-sm);
  }
  .v {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
  }
  .v small {
    margin-left: 0.1rem;
    font-size: 1.25rem;
    text-transform: uppercase;
  }
  .time {
    color: var(--accent-hi);
  }
  .vol {
    color: var(--info);
  }
  .kcal {
    color: var(--danger);
  }
  .sets {
    color: var(--ember);
  }
  .rec {
    color: #ffd84d;
  }
  .rest {
    color: #5fd4c4;
  }
</style>
