<script lang="ts">
  import { t } from '#lib/i18n';
  import { formatDuration } from '#lib/workout-math';

  /** What a session added up to: duration, sets, volume and estimated calories. */
  let { seconds, sets, volume, unit, kcal }: { seconds: number | null; sets: number; volume: number; unit: string; kcal: number | null } = $props();
</script>

<section class="stats">
  <div><span class="v">{seconds ? formatDuration(seconds) : '—'}</span><span class="k">{t('finish.duration')}</span></div>
  <div><span class="v">{sets}</span><span class="k">{t('finish.sets')}</span></div>
  <div><span class="v">{volume.toLocaleString()}</span><span class="k">{t('finish.volume', { unit })}</span></div>
  <div class="kcal"><span class="v">{kcal ? `≈ ${kcal}` : '—'}</span><span class="k">kcal</span></div>
</section>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 1.25rem 0 0.5rem;
  }
  .stats div {
    display: grid;
    padding: 0.75rem 0.9rem;
    border-radius: var(--radius);
    background: var(--surface-hi);
  }
  .v {
    font-size: var(--t-lg);
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .k {
    color: var(--muted);
    font-size: var(--t-xs);
  }
  .kcal .v {
    color: var(--ember);
  }
</style>
