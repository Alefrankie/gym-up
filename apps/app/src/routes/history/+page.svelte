<script lang="ts">
  import { t } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { workoutHistoryResponseSchema, type WorkoutHistoryResponse } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import WorkoutHistoryRow from '#lib/components/WorkoutHistoryRow.svelte';

  let history = $state<WorkoutHistoryResponse | null>(null);
  let page = $state(1);
  let error = $state<string | null>(null);
  let stale = $state(false);

  async function load(p: number) {
    error = null;
    try {
      const res = await cachedGet(`/workouts?page=${p}`, workoutHistoryResponseSchema, { onCached: (c) => ((history = c.data), (page = p)) });
      history = res.data;
      stale = res.stale;
      page = p;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('history.offlineEmpty')
          : e instanceof ApiRequestError
            ? e.message
            : t('history.loadError');
    }
  }

  onMount(async () => {
    if (await session.require()) await load(1);
  });

</script>

<main>
  <h1>{t('history.title')}</h1>
  <SyncBanner />
  {#if stale}<p class="muted">{t('history.stale')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !history && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if history && history.items.length === 0}
    <section class="card empty">
      <Icon name="dumbbell" size={20} />
      <p>{t('history.empty')}</p>
      <a href="/dashboard">{t('history.startToday')}</a>
    </section>
  {:else if history}
    <ul class="list">
      {#each history.items as item}
        <li><WorkoutHistoryRow {item} /></li>
      {/each}
    </ul>
    {#if history.totalPages > 1}
      <div class="pager">
        <button disabled={page <= 1} onclick={() => load(page - 1)}>{t('history.prev')}</button>
        <span class="muted">{page} / {history.totalPages}</span>
        <button disabled={page >= history.totalPages} onclick={() => load(page + 1)}>{t('history.next')}</button>
      </div>
    {/if}
  {/if}
</main>

<AppNav />

<style>
  .empty {
    display: grid;
    justify-items: center;
    gap: 0.4rem;
    text-align: center;
    padding: 1.5rem 0.9rem;
    color: var(--muted);
  }
  .empty p {
    margin: 0;
  }
  .empty a {
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .pager .muted {
    font-size: var(--t-sm);
  }
  .pager {
    margin-top: 0.5rem;
  }
</style>
