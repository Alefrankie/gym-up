<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { libraryExerciseDtoSchema, type CreateExerciseRequest } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import ExerciseForm, { type ExerciseFormValue } from '#lib/components/ExerciseForm.svelte';

  let busy = $state(false);
  let error = $state<string | null>(null);

  onMount(() => {
    void session.require();
  });

  async function submit(value: ExerciseFormValue) {
    busy = true;
    error = null;
    try {
      const body = { id: crypto.randomUUID(), ...value } as CreateExerciseRequest;
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
  <ExerciseForm {busy} {error} submitLabel="Guardar ejercicio" onsubmit={submit} />
</main>
