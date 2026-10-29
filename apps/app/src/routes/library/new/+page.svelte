<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import {
    EQUIPMENT,
    EXERCISE_TYPES,
    MUSCLE_GROUPS,
    libraryExerciseDtoSchema,
    type CreateExerciseRequest,
  } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { invalidateCache } from '#lib/offline/cache';
  import { EQUIPMENT_LABELS, MUSCLE_LABELS, TYPE_LABELS } from '#lib/labels';
  import { session } from '#lib/session';

  let name = $state('');
  let primaryMuscle = $state<string>('chest');
  let secondary = $state<string[]>([]);
  let equipment = $state<string>('dumbbell');
  let exerciseType = $state<string>('weight_reps');
  let instructions = $state('');
  let videoUrl = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  onMount(() => {
    void session.require();
  });

  function toggleSecondary(m: string) {
    secondary = secondary.includes(m) ? secondary.filter((x) => x !== m) : [...secondary, m];
  }

  async function submit(ev: SubmitEvent) {
    ev.preventDefault();
    busy = true;
    error = null;
    const body = {
      id: crypto.randomUUID(),
      name,
      primaryMuscle,
      secondaryMuscles: secondary.filter((m) => m !== primaryMuscle),
      equipment,
      exerciseType,
      instructions: instructions || null,
      videoUrl: videoUrl || null,
    } as CreateExerciseRequest;
    try {
      const created = await api('/exercises', { method: 'POST', body, schema: libraryExerciseDtoSchema });
      await invalidateCache(['/exercises']);
      await goto(`/library/${created.id}`);
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión: conéctate para crear un ejercicio propio.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudo crear el ejercicio';
      busy = false;
    }
  }
</script>

<main>
  <p class="muted"><a href="/library">← Biblioteca</a></p>
  <h1>Nuevo ejercicio</h1>
  <form onsubmit={submit}>
    <label>Nombre <input required minlength="2" maxlength="60" bind:value={name} /></label>
    <label>
      Músculo principal
      <select bind:value={primaryMuscle}>
        {#each MUSCLE_GROUPS as m}<option value={m}>{MUSCLE_LABELS[m]}</option>{/each}
      </select>
    </label>
    <fieldset>
      <legend class="muted">Músculos secundarios</legend>
      <div class="chips">
        {#each MUSCLE_GROUPS.filter((m) => m !== primaryMuscle) as m}
          <button type="button" class="chip" class:on={secondary.includes(m)} onclick={() => toggleSecondary(m)}>
            {MUSCLE_LABELS[m]}
          </button>
        {/each}
      </div>
    </fieldset>
    <label>
      Equipo
      <select bind:value={equipment}>
        {#each EQUIPMENT as e}<option value={e}>{EQUIPMENT_LABELS[e]}</option>{/each}
      </select>
    </label>
    <label>
      Tipo
      <select bind:value={exerciseType}>
        {#each EXERCISE_TYPES as t}<option value={t}>{TYPE_LABELS[t]}</option>{/each}
      </select>
    </label>
    <label>Instrucciones (opcional) <textarea rows="4" maxlength="2000" bind:value={instructions}></textarea></label>
    <label>Enlace de vídeo (opcional) <input type="url" maxlength="300" bind:value={videoUrl} /></label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="primary" disabled={busy}>Guardar ejercicio</button>
  </form>
</main>

<style>
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.4rem;
  }
  .chip {
    padding: 0.35rem 0.7rem;
    border-radius: 1rem;
    font-size: 0.9rem;
  }
  .chip.on {
    background: var(--accent);
    color: #052e16;
    border-color: var(--accent);
  }
  textarea {
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #334155;
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }
</style>
