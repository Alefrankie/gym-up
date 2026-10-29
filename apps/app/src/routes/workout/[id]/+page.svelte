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

  async function cancel() {
    if (!confirm('¿Cancelar este entrenamiento? Se borra todo lo que hayas registrado en él.')) return;
    await view.cancel();
  }
</script>

<header class="bar">
  <a class="back round" href="/dashboard" aria-label="Volver al inicio"><Icon name="left" size={20} /></a>
  <h1>{view.snap?.dayName ?? 'Entrenamiento'}</h1>
  {#if view.elapsed}
    <span class="elapsed" role="timer" aria-label="Tiempo de entrenamiento"><Icon name="timer" size={14} />{view.elapsed}</span>
  {:else}
    <span></span>
  {/if}
</header>

<TargetMuscles muscles={muscleLoad(exercises)} />

<h2>{exercises.length} {exercises.length === 1 ? 'ejercicio' : 'ejercicios'}</h2>
<ul class="rows">
  {#each exercises as ex (ex.exerciseId)}
    <li><ExerciseRow {ex} unit={view.unit} href={`/workout/${id}/${ex.exerciseId}`} progress={view.progress(ex)} sets={view.doneSets(ex)} /></li>
  {/each}
</ul>

{#if view.isCompleted}
  <p class="ok"><Icon name="check" size={16} /> Entrenamiento completado</p>
{:else}
  <button class="danger cancel" disabled={view.cancelling || view.finishing} onclick={cancel}>
    <Icon name="trash" size={16} /> Cancelar entrenamiento
  </button>
  <div class="cta">
    <button class="primary" disabled={view.finishing || !view.anyCompleted} onclick={() => view.finish()}>
      {view.finishing ? 'Finalizando…' : 'Finalizar entrenamiento'}
    </button>
  </div>
{/if}

<style>
  .bar {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    align-items: center;
    gap: 0.5rem;
    margin: 0.25rem 0 1rem;
  }
  .bar h1 {
    margin: 0;
    font-size: var(--t-md);
    font-weight: 600;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .round {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow-card);
    color: var(--text);
  }
  .elapsed {
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
  .rows {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .cancel {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    width: 100%;
    margin-bottom: 1rem;
    font-size: var(--t-sm);
  }
  .ok {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--t-sm);
  }
  .cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, transparent, var(--bg) 45%);
    pointer-events: none;
  }
  .cta button {
    display: block;
    max-width: 22rem;
    margin: 0 auto;
    pointer-events: auto;
  }
</style>
