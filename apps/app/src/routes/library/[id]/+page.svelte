<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { libraryExerciseDtoSchema, type LibraryExerciseDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { TYPE_LABELS, equipment, muscle } from '#lib/labels';
  import { session } from '#lib/session';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';

  const id = $derived(page.params.id ?? '');
  let exercise = $state<LibraryExerciseDto | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      exercise = (await cachedGet(`/exercises/${id}`, libraryExerciseDtoSchema)).data;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y este ejercicio no está guardado.'
          : e instanceof ApiRequestError && e.status === 404
            ? 'Ejercicio no encontrado'
            : 'No se pudo cargar el ejercicio';
    }
  });

  const mine = $derived(exercise?.isCustom && exercise.ownerId === session.user?.id);
  const steps = $derived(
    (exercise?.instructions ?? '')
      .split('\n')
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean),
  );

  async function archive() {
    if (!confirm('¿Archivar este ejercicio? Seguirá apareciendo en tus entrenamientos anteriores.')) return;
    busy = true;
    try {
      await api(`/exercises/${id}`, { method: 'DELETE' });
      await invalidateCache(['/exercises']);
      await goto('/library');
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'No se pudo archivar';
      busy = false;
    }
  }
</script>

<main>
  <p><a class="back" href="/library"><Icon name="left" size={18} /> Biblioteca</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if exercise}
    <h1>{exercise.name}</h1>
    {#if exercise.isArchived}<p class="muted">Archivado</p>{/if}

    <section class="card hero figure">
      <MuscleFigure
        primary={exercise.primaryMuscle}
        secondary={exercise.secondaryMuscles}
        view="both"
        size={96}
        label={`Músculos trabajados: ${muscle(exercise.primaryMuscle)}`}
      />
      <dl>
        <dt>Principal</dt>
        <dd class="main">{muscle(exercise.primaryMuscle)}</dd>
        {#if exercise.secondaryMuscles.length}
          <dt>Secundarios</dt>
          <dd>{exercise.secondaryMuscles.map(muscle).join(', ')}</dd>
        {/if}
        <dt>Equipo</dt>
        <dd>{equipment(exercise.equipment)}</dd>
        <dt>Registro</dt>
        <dd>{TYPE_LABELS[exercise.exerciseType] ?? exercise.exerciseType}</dd>
      </dl>
    </section>

    {#if steps.length}
      <h2>Cómo se hace</h2>
      <ol class="steps">
        {#each steps as s, i}
          <li><span class="n">{i + 1}</span><span>{s}</span></li>
        {/each}
      </ol>
    {/if}

    {#if exercise.videoUrl}
      <p><a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer">Ver vídeo</a></p>
    {/if}

    {#if mine && !exercise.isArchived}
      <div class="actions">
        <a class="edit" href={`/library/${id}/edit`}><Icon name="edit" size={18} /> Editar</a>
        <button class="danger" disabled={busy} onclick={archive}><Icon name="trash" size={18} /> Archivar</button>
      </div>
    {/if}
  {:else if !error}
    <p class="muted">Cargando…</p>
  {/if}
</main>

<style>
  .figure {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  dl {
    margin: 0;
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }
  dt {
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 500;
    margin-top: 0.45rem;
  }
  dd {
    margin: 0;
    font-weight: 600;
  }
  dd.main {
    color: var(--accent-hi);
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.1;
  }
  .steps {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }
  .steps li {
    display: flex;
    gap: 0.8rem;
    align-items: flex-start;
    padding: 0.7rem 0.9rem;
    border-radius: var(--radius);
    background: linear-gradient(180deg, var(--surface-hi), var(--surface));
    box-shadow: var(--shadow-card);
  }
  .n {
    flex: none;
    display: grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-hi);
    font-family: var(--font-display);
    font-weight: 800;
  }
  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .actions > * {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }
  .edit {
    min-height: 48px;
    border-radius: var(--radius-sm);
    background: linear-gradient(180deg, var(--raised), var(--surface-hi));
    box-shadow: var(--shadow-card);
    color: var(--text);
    font-weight: 600;
    text-decoration: none;
  }
</style>
