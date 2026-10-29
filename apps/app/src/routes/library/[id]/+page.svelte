<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { libraryExerciseDtoSchema, type LibraryExerciseDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { TYPE_LABELS, equipment, muscle } from '#lib/labels';
  import { session } from '#lib/session';

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
  const steps = $derived((exercise?.instructions ?? '').split('\n').filter(Boolean));

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
  <p class="muted"><a href="/library">← Biblioteca</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if exercise}
    <h1>{exercise.name}</h1>
    {#if exercise.isArchived}<p class="muted">Archivado</p>{/if}
    <section class="card">
      <p><strong>Músculo principal:</strong> {muscle(exercise.primaryMuscle)}</p>
      {#if exercise.secondaryMuscles.length}
        <p><strong>Secundarios:</strong> {exercise.secondaryMuscles.map(muscle).join(', ')}</p>
      {/if}
      <p><strong>Equipo:</strong> {equipment(exercise.equipment)}</p>
      <p><strong>Tipo:</strong> {TYPE_LABELS[exercise.exerciseType] ?? exercise.exerciseType}</p>
    </section>
    {#if steps.length}
      <section class="card">
        <h2>Cómo se hace</h2>
        <ul class="steps">
          {#each steps as s}<li>{s}</li>{/each}
        </ul>
      </section>
    {/if}
    {#if exercise.videoUrl}
      <p><a href={exercise.videoUrl} target="_blank" rel="noopener noreferrer">Ver vídeo</a></p>
    {/if}
    {#if mine && !exercise.isArchived}
      <p><a href={`/library/${id}/edit`}>Editar ejercicio</a></p>
      <button class="danger" disabled={busy} onclick={archive}>Archivar ejercicio</button>
    {/if}
  {:else if !error}
    <p class="muted">Cargando…</p>
  {/if}
</main>

<style>
  .steps {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }
  .danger {
    color: var(--danger);
    border-color: var(--danger);
  }
</style>
