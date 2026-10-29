<script lang="ts">
  import { page } from '$app/state';
  import { muscleLoad } from '#lib/muscle-load';
  import { useWorkoutView } from '#lib/offline/workout-context';
  import ExerciseRow from '#lib/components/ExerciseRow.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import TargetMuscles from '#lib/components/TargetMuscles.svelte';

  const view = useWorkoutView();
  const id = $derived(page.params.id ?? '');
  const exercises = $derived(view.snap?.exercises ?? []);
</script>

<header class="bar">
  <a class="back round" href="/dashboard" aria-label="Volver al inicio"><Icon name="left" size={22} /></a>
  <h1>{view.snap?.dayName ?? 'Entrenamiento'}</h1>
  {#if view.elapsed}
    <span class="elapsed" role="timer" aria-label="Tiempo de entrenamiento"><Icon name="timer" size={18} />{view.elapsed}</span>
  {:else}
    <span></span>
  {/if}
</header>

<TargetMuscles muscles={muscleLoad(exercises)} />

<h2>{exercises.length} {exercises.length === 1 ? 'ejercicio' : 'ejercicios'}</h2>
<ul class="rows">
  {#each exercises as ex (ex.exerciseId)}
    <li><ExerciseRow {ex} unit={view.unit} href={`/workout/${id}/${ex.exerciseId}`} progress={view.progress(ex)} /></li>
  {/each}
</ul>

{#if view.isCompleted}
  <p class="ok"><Icon name="check" size={18} /> Entrenamiento completado</p>
{:else}
  <div class="cta">
    <button class="primary" disabled={view.finishing || !view.anyCompleted} onclick={() => view.finish()}>
      {view.finishing ? 'Finalizando…' : 'Finalizar entrenamiento'}
    </button>
  </div>
{/if}

<style>
  .bar {
    display: grid;
    grid-template-columns: 2.75rem 1fr auto;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.4rem;
  }
  .bar h1 {
    margin: 0;
    font-size: 1.7rem;
    text-align: center;
  }
  .round {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border-radius: 50%;
    background: linear-gradient(180deg, var(--surface-hi), var(--surface));
    box-shadow: var(--shadow-card);
    color: var(--text);
  }
  .elapsed {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-hi);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.15rem;
  }
  .rows {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    gap: 0.7rem;
  }
  .ok {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1.5rem 1rem calc(1rem + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, transparent, var(--bg) 55%);
    pointer-events: none;
  }
  .cta button {
    display: block;
    max-width: 22rem;
    margin: 0 auto;
    pointer-events: auto;
    border-radius: 999px;
  }
</style>
