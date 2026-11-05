<script lang="ts">
  import { t } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { communityPageSchema, type CommunityWorkoutDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError, api } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import { markNoticeSeen, noticeSeen } from '#lib/community';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import WorkoutCard from '#lib/components/WorkoutCard.svelte';

  let items = $state<CommunityWorkoutDto[] | null>(null);
  let next = $state<string | null>(null);
  let stale = $state(false);
  let error = $state<string | null>(null);
  let loadingMore = $state(false);
  let showNotice = $state(!noticeSeen());

  const message = (e: unknown, offline: string) =>
    e instanceof NetworkError ? offline : e instanceof ApiRequestError ? e.message : t('community.loadError');

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      // Only the first page is cached: enough to open the tab with no signal.
      const res = await cachedGet('/community/feed', communityPageSchema, { onCached: (c) => ((items = c.data.items), (next = c.data.nextCursor)) });
      items = res.data.items;
      next = res.data.nextCursor;
      stale = res.stale;
    } catch (e) {
      error = message(e, t('community.offlineEmpty'));
    }
  });

  async function more() {
    if (!next || loadingMore) return;
    loadingMore = true;
    try {
      const res = await api(`/community/feed?cursor=${encodeURIComponent(next)}`, { schema: communityPageSchema });
      const seen = new Set(items?.map((w) => w.id));
      items = [...(items ?? []), ...res.items.filter((w) => !seen.has(w.id))];
      next = res.nextCursor;
    } catch (e) {
      error = message(e, t('common.needsConnection'));
    } finally {
      loadingMore = false;
    }
  }

  function dismiss() {
    markNoticeSeen();
    showNotice = false;
  }
</script>

<main>
  <header class="top">
    <h1>{t('community.title')}</h1>
    <a class="members" href="/community/members"><Icon name="users" size={20} />{t('community.members')}</a>
  </header>

  {#if showNotice}
    <section class="notice" aria-live="polite">
      <Icon name="eye" size={20} />
      <p>{t('community.notice')}</p>
      <button class="ghost" onclick={dismiss}>{t('community.noticeOk')}</button>
    </section>
  {/if}

  {#if stale}<p class="muted">{t('community.stale')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if !items && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if items && items.length === 0}
    <section class="empty">
      <p>{t('community.empty')}</p>
      <a href="/community/members">{t('community.membersAll')}</a>
    </section>
  {:else if items}
    <div class="feed">
      {#each items as w (w.id)}
        <WorkoutCard workout={w} />
      {/each}
    </div>
    {#if next}
      <button class="more" disabled={loadingMore} onclick={more}>{loadingMore ? t('common.loading') : t('community.more')}</button>
    {/if}
  {/if}
</main>

<AppNav />

<style>
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .top h1 {
    margin: 0;
  }
  .members {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 48px;
    padding: 0 0.25rem;
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
  }
  .notice {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    align-items: start;
    margin: 1rem 0;
    padding: 0.875rem 1rem;
    border-radius: var(--radius);
    background: var(--accent-soft);
    color: var(--text);
  }
  .notice :global(svg) {
    margin-top: 0.15rem;
    color: var(--accent);
  }
  .notice p {
    margin: 0;
    font-size: var(--t-sm);
    line-height: 1.45;
  }
  .notice button {
    grid-column: 2;
    justify-self: start;
    min-height: 44px;
    padding-left: 0;
    color: var(--accent);
  }
  .feed {
    display: grid;
    gap: 1rem;
    margin-top: 1rem;
  }
  .more {
    width: 100%;
    margin-top: 1rem;
    min-height: 48px;
  }
  .empty {
    margin-top: 2rem;
    display: grid;
    gap: 0.5rem;
    color: var(--muted);
  }
  .empty a {
    color: var(--accent);
    min-height: 44px;
  }
</style>
