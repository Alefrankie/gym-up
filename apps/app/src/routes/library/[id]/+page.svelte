<script lang="ts">
  import { t } from '#lib/i18n';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { libraryExerciseDtoSchema, type LibraryExerciseDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import Icon from '#lib/components/Icon.svelte';
  import ExerciseInfo from '#lib/components/ExerciseInfo.svelte';

  const id = $derived(page.params.id ?? '');
  let exercise = $state<LibraryExerciseDto | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      exercise = (await cachedGet(`/exercises/${id}`, libraryExerciseDtoSchema, { onCached: (c) => (exercise = c.data) })).data;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('exercise.offlineNotSaved')
          : e instanceof ApiRequestError && e.status === 404
            ? t('exercise.notFound')
            : t('exercise.loadError');
    }
  });

  const mine = $derived(exercise?.isCustom && exercise.ownerId === session.user?.id);
  async function archive() {
    if (!confirm(t('exercise.archiveConfirm'))) return;
    busy = true;
    try {
      await api(`/exercises/${id}`, { method: 'DELETE' });
      await invalidateCache(['/exercises']);
      await goto('/library');
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : t('programs.archiveError');
      busy = false;
    }
  }
</script>

<main>
  <p><a class="back" href="/library"><Icon name="left" size={16} /> {t('library.title')}</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if exercise}
    <h1>{exercise.name}</h1>
    {#if exercise.isArchived}<p class="muted">{t('exercise.archived')}</p>{/if}

    <ExerciseInfo {exercise} />

    {#if mine && !exercise.isArchived}
      <div class="actions">
        <a class="edit" href={`/library/${id}/edit`}><Icon name="edit" size={16} /> {t('common.edit')}</a>
        <button class="danger" disabled={busy} onclick={archive}><Icon name="trash" size={16} /> {t('exercise.archive')}</button>
      </div>
    {/if}
  {:else if !error}
    <p class="muted loading">{t('common.loading')}</p>
  {/if}
</main>

<style>
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.25rem;
  }
  .actions > * {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    font-size: var(--t-sm);
  }
  .edit {
    min-height: var(--control);
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--text);
    font-weight: 550;
    text-decoration: none;
  }
</style>
