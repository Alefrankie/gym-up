<script lang="ts">
  import { muscle as muscleLabel } from '#lib/labels';
  import MuscleFigure from './MuscleFigure.svelte';

  let { muscles }: { muscles: Array<{ muscle: string; pct: number }> } = $props();
</script>

<section aria-label="Músculos objetivo">
  <h2>Músculos objetivo</h2>
  <ul>
    {#each muscles as m (m.muscle)}
      <li>
        <span class="tile"><MuscleFigure primary={m.muscle} size={30} /></span>
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
    margin-top: 1.2rem;
  }
  ul {
    list-style: none;
    margin: 0 -1rem;
    padding: 0.2rem 1rem 0.8rem;
    display: flex;
    gap: 0.7rem;
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
    gap: 0.6rem;
    padding: 0.4rem 0.9rem 0.4rem 0.4rem;
    border-radius: var(--radius);
    background: linear-gradient(180deg, var(--surface-hi), var(--surface));
    box-shadow: var(--shadow-card);
  }
  .tile {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 4.4rem;
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: 0 2px 5px rgb(0 0 0 / 0.4) inset;
  }
  .txt {
    display: grid;
  }
  .name {
    font-weight: 600;
  }
  b {
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--ember);
  }
  b.full {
    color: var(--ok);
  }
</style>
