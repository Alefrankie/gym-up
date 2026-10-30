<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import Select from '#lib/components/Select.svelte';
  import { onMount } from 'svelte';
  import { EQUIPMENT, libraryExerciseListResponseSchema, type LibraryExerciseDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { EQUIPMENT_LABELS, equipment as eqLabel, muscle as muscleLabel } from '#lib/labels';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import ExerciseFilters from '#lib/components/ExerciseFilters.svelte';
  import { emptyFilter, filterExercises } from '#lib/exercise-filter';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';

  let items = $state<LibraryExerciseDto[]>([]);
  let loaded = $state(false);
  let error = $state<string | null>(null);
  let stale = $state(false);
  let filter = $state(emptyFilter());
  let mineOnly = $state(false);

  // The whole catalog is small (tens of rows), so it is fetched once and filtered on the device: instant and offline.
  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const res = await cachedGet('/exercises', libraryExerciseListResponseSchema, { onCached: (c) => ((items = c.data.items), (loaded = true)) });
      items = res.data.items;
      stale = res.stale;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('library.offlineEmpty')
          : e instanceof ApiRequestError
            ? e.message
            : t('library.loadError');
    }
    loaded = true;
  });

  const visible = $derived(
    filterExercises(items, filter).filter((e) => !mineOnly || (e.isCustom && e.ownerId === session.user?.id)),
  );
</script>

<main>
  <p><a class="back" href="/programs"><Icon name="left" size={16} /> {t('nav.train')}</a></p>
  <h1>{t('library.title')}</h1>
  {#if stale}<p class="muted">{t('library.stale')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <ExerciseFilters bind:filter />

  <label class="mine"><input type="checkbox" bind:checked={mineOnly} /> {t('library.mineOnly')}</label>

  <p class="count muted">{tn('workout.exerciseCount', visible.length)}</p>

  {#if !loaded}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if visible.length === 0}
    <section class="card empty">
      <p>{t('library.noMatch')}</p>
      <a href="/library/new">{t('library.createOwn')}</a>
    </section>
  {:else}
    <ul class="list">
      {#each visible as e (e.id)}
        <li>
          <a href={`/library/${e.id}`}>
            <MuscleFigure primary={e.primaryMuscle} secondary={e.secondaryMuscles} size={22} />
            <span class="grow">
              <strong>{e.name}{#if e.isCustom} <span class="badge">{t('library.custom')}</span>{/if}</strong>
              <span class="muted">{muscleLabel(e.primaryMuscle)} · {eqLabel(e.equipment)}</span>
            </span>
            <Icon name="right" size={16} />
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<a class="fab" href="/library/new" aria-label={t('library.new')}><Icon name="plus" size={20} /></a>
<AppNav />

<style>
  .mine {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    white-space: nowrap;
    font-size: var(--t-sm);
  }
  .count {
    margin: 1rem 0 0;
    font-size: var(--t-xs);
  }
  .list a > :global(svg:last-child) {
    flex: none;
    color: var(--faint);
  }
  .empty {
    text-align: center;
  }
  .fab {
    position: fixed;
    right: 1rem;
    bottom: calc(5.4rem + env(safe-area-inset-bottom));
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--surface-hi);
    box-shadow: var(--shadow-pop);
    color: var(--accent);
  }
</style>
