<script lang="ts">
  import { t } from '#lib/i18n';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { libraryExerciseDtoSchema, type LibraryExerciseDto, type UpdateExerciseRequest } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import Icon from '#lib/components/Icon.svelte';
  import ExerciseForm, { type ExerciseFormValue } from '#lib/components/ExerciseForm.svelte';

  const id = $derived(page.params.id ?? '');
  let exercise = $state<LibraryExerciseDto | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      // Always fresh from the server: the form must not start from a stale cached copy.
      const fresh = await api(`/exercises/${id}`, { schema: libraryExerciseDtoSchema });
      if (!fresh.isCustom || fresh.ownerId !== session.user?.id) {
        error = t('exercise.onlyOwn');
        return;
      }
      exercise = fresh;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('exercise.editOffline')
          : e instanceof ApiRequestError
            ? e.message
            : t('exercise.loadError');
    }
  });

  async function submit(value: ExerciseFormValue) {
    busy = true;
    error = null;
    try {
      await api(`/exercises/${id}`, {
        method: 'PATCH',
        body: value as UpdateExerciseRequest,
        schema: libraryExerciseDtoSchema,
      });
      await invalidateCache(['/exercises']);
      await goto(`/library/${id}`);
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('exercise.saveOffline')
          : e instanceof ApiRequestError
            ? e.message
            : t('programs.saveError');
      busy = false;
    }
  }
</script>

<main>
  <p><a class="back" href={`/library/${id}`}><Icon name="left" size={16} /> {t('exercise.back')}</a></p>
  <h1>{t('exercise.edit')}</h1>
  {#if exercise}
    <ExerciseForm initial={exercise} {busy} {error} submitLabel={t('common.saveChanges')} onsubmit={submit} />
  {:else if error}
    <p class="error" role="alert">{error}</p>
  {:else}
    <p class="muted loading">{t('common.loading')}</p>
  {/if}
</main>
