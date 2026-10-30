<script lang="ts">
  import { muscle as muscleLabel } from '#lib/labels';
  import { t } from '#lib/i18n';
  import MuscleFigure from './MuscleFigure.svelte';

  let { muscles }: { muscles: Array<{ muscle: string; pct: number }> } = $props();
</script>

<section aria-label={t('workout.targetMuscles')}>
  <h2>{t('workout.targetMuscles')}</h2>
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
  section h2 {
    margin-top: 1.25rem;
  }
  ul {
    list-style: none;
    margin: 0 -1rem;
    padding: 0 1rem 0.25rem;
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
