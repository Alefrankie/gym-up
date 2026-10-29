<script lang="ts">
  import type { LibraryExerciseDto } from '@gym-up/contracts';
  import { equipment, muscle } from '#lib/labels';
  import Icon from './Icon.svelte';
  import MuscleFigure from './MuscleFigure.svelte';

  let {
    exercises,
    title,
    onpick,
    onclose,
  }: {
    exercises: LibraryExerciseDto[];
    title: string;
    onpick: (exercise: LibraryExerciseDto) => void;
    onclose: () => void;
  } = $props();

  let q = $state('');
  let input = $state<HTMLInputElement>();
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const matches = $derived(exercises.filter((e) => !q || norm(e.name).includes(norm(q))).slice(0, 60));

  $effect(() => {
    input?.focus();
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
  <header>
    <h2>{title}</h2>
    <button class="icon ghost" onclick={onclose} aria-label="Cerrar"><Icon name="x" size={22} /></button>
  </header>
  <div class="search">
    <Icon name="search" size={20} />
    <input bind:this={input} type="search" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" bind:value={q} />
  </div>
  <ul>
    {#each matches as ex (ex.id)}
      <li>
        <button class="pick" onclick={() => onpick(ex)}>
          <span class="tile"><MuscleFigure primary={ex.primaryMuscle} secondary={ex.secondaryMuscles} size={22} /></span>
          <span class="grow">
            <strong>{ex.name}</strong>
            <span class="muted">{muscle(ex.primaryMuscle)} · {equipment(ex.equipment)}</span>
          </span>
        </button>
      </li>
    {:else}
      <li class="muted empty">Ningún ejercicio coincide.</li>
    {/each}
  </ul>
</div>

<style>
  .sheet {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: calc(env(safe-area-inset-top) + 0.5rem) 1rem calc(1rem + env(safe-area-inset-bottom));
    background: radial-gradient(120% 40% at 50% -8%, var(--bg-glow), transparent 70%), var(--bg);
    animation: rise 220ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes rise {
    from {
      transform: translateY(2rem);
      opacity: 0;
    }
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  header h2 {
    margin: 0.5rem 0;
  }
  .search {
    position: relative;
    display: flex;
    align-items: center;
    color: var(--muted);
  }
  .search :global(svg) {
    position: absolute;
    left: 0.8rem;
    pointer-events: none;
  }
  .search input {
    flex: 1;
    padding-left: 2.6rem;
  }
  ul {
    flex: 1;
    overflow-y: auto;
    list-style: none;
    margin: 0 -1rem;
    padding: 0.2rem 1rem;
    display: grid;
    gap: 0.6rem;
    align-content: start;
  }
  .pick {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.5rem 0.8rem 0.5rem 0.5rem;
    text-align: left;
  }
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3.6rem;
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: 0 2px 5px rgb(0 0 0 / 0.4) inset;
  }
  .grow {
    display: grid;
    min-width: 0;
  }
  .empty {
    padding: 1rem 0;
  }
</style>
