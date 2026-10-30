<script lang="ts">
  import { muscle as muscleLabel } from '#lib/labels';
  import { t } from '#lib/i18n';
  import MuscleFigure from './MuscleFigure.svelte';

  /** `compact`: no heading and the row stays inside its container (for use inside a card). */
  let { muscles, compact = false }: { muscles: Array<{ muscle: string; pct: number }>; compact?: boolean } = $props();
</script>

<section class:compact aria-label={t('workout.targetMuscles')}>
  {#if !compact}<h2>{t('workout.targetMuscles')}</h2>{/if}
  <ul>
    {#each muscles as m (m.muscle)}
      <li>
        <span class="tile"><MuscleFigure primary={m.muscle} size={20} /></span>
        <span class="txt">
          <span class="name">{muscleLabel(m.muscle)}</span>
          <b class:full={m.pct === 100}>{m.pct}%</b>
        </span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .compact ul {
    margin: 0.5rem -2px 0;
    padding: 3px 2px 0.35rem;
  }
  section h2 {
    margin-top: 1.25rem;
  }
  ul {
    list-style: none;
    margin: 0 -1rem;
    /* Room above and below: a scroller clips anything outside it, including the cards' 1px ring. */
    padding: 3px 1rem 0.35rem;
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
  }
  ul::-webkit-scrollbar {
    display: none;
  }
  li {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 48px;
    padding: 0.25rem 0.75rem 0.25rem 0.25rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
  .tile {
    display: grid;
    place-items: center;
    width: 32px;
    height: 40px;
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    overflow: hidden;
  }
  .txt {
    display: grid;
    line-height: 1.25;
  }
  .name {
    font-size: var(--t-sm);
    font-weight: 500;
  }
  b {
    font-size: var(--t-sm);
    font-weight: 600;
    color: var(--ember);
  }
  b.full {
    color: var(--ok);
  }
</style>
