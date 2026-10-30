<script lang="ts">
  import { t } from '#lib/i18n';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { libraryExerciseDtoSchema, type CreateExerciseRequest } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import Icon from '#lib/components/Icon.svelte';
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
          ? t('exercise.createOffline')
          : e instanceof ApiRequestError
            ? e.message
            : t('exercise.createError');
      busy = false;
    }
  }
</script>

<main>
  <p><a class="back" href="/library"><Icon name="left" size={16} /> {t('library.title')}</a></p>
  <h1>{t('library.new')}</h1>
  <ExerciseForm {busy} {error} submitLabel={t('exercise.save')} onsubmit={submit} />
</main>
