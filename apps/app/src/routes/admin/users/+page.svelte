<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api, ApiRequestError } from '#lib/api/client';
  import { session } from '#lib/session';
  import { t, tn, dateLocale } from '#lib/i18n';
  import { adminUserListSchema } from '@gym-up/contracts';
  import type { AdminUserDto } from '@gym-up/contracts';
  import AppNav from '#lib/components/AppNav.svelte';

  const PAGE_SIZE = 50;
  let users = $state<AdminUserDto[]>([]);
  let search = $state('');
  let appliedSearch = $state('');
  let total = $state(0);
  let offset = $state(0);
  let loading = $state(true);
  let error = $state('');

  const pageNumber = $derived(Math.floor(offset / PAGE_SIZE) + 1);
  const pageCount = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const dateTime = (value: string) => new Date(value).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' });

  async function loadUsers(nextOffset = offset, nextQuery = appliedSearch) {
    loading = true;
    error = '';
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
      if (nextQuery) params.set('q', nextQuery);
      const result = await api(`/admin/users?${params}`, { schema: adminUserListSchema });
      users = result.items;
      total = result.total;
      offset = nextOffset;
      appliedSearch = nextQuery;
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 401) {
        await goto('/login', { replaceState: true });
        return;
      }
      error = cause instanceof ApiRequestError && cause.status === 403 ? t('admin.users.forbidden') : t('admin.users.loadError');
    } finally {
      loading = false;
    }
  }

  async function initialize() {
    try {
      const user = await session.require();
      if (!user) return;
      if (!user.isAdmin) {
        await goto('/more', { replaceState: true });
        return;
      }
      await loadUsers(0, '');
    } catch {
      error = t('admin.users.loadError');
      loading = false;
    }
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    void loadUsers(0, search.trim());
  }

  onMount(() => { void initialize(); });
</script>

<main>
  <h1>{t('admin.users.title')}</h1>
  <form class="search" onsubmit={submitSearch}>
    <label for="user-search">{t('admin.users.searchLabel')}</label>
    <div class="search-row">
      <input id="user-search" type="search" bind:value={search} placeholder={t('admin.users.searchPlaceholder')} autocomplete="off" maxlength="120" />
      <button class="primary" type="submit" disabled={loading}>{t('admin.users.search')}</button>
    </div>
  </form>

  {#if !loading && !error}<p class="muted count">{tn('admin.users.count', total)}</p>{/if}

  {#if loading}
    <div class="user-list" aria-label={t('admin.users.loading')} aria-busy="true">
      {#each [1, 2, 3] as item (item)}<div class="card skeleton" aria-hidden="true"></div>{/each}
    </div>
  {:else if error}
    <section class="card message" role="alert">
      <p class="error">{error}</p>
      <button type="button" class="secondary" onclick={() => loadUsers()}>{t('common.retry')}</button>
    </section>
  {:else if users.length === 0}
    <p class="card message muted">{appliedSearch ? t('admin.users.emptySearch') : t('admin.users.empty')}</p>
  {:else}
    <section class="user-list" aria-label={t('admin.users.title')}>
      {#each users as user (user.id)}
        <article class="card user-row">
          <div class="identity">
            <h2>{user.displayName}</h2>
            {#if user.isAdmin}<span class="admin-tag">{t('admin.users.admin')}</span>{/if}
          </div>
          <p class="email">{user.email}</p>
          <dl class="dates">
            <div><dt>{t('admin.users.registrationDate')}</dt><dd>{dateTime(user.createdAt)}</dd></div>
            <div><dt>{t('admin.users.lastAccess')}</dt><dd>{user.lastAccessAt ? dateTime(user.lastAccessAt) : t('admin.users.lastAccessUnknown')}</dd></div>
          </dl>
        </article>
      {/each}
    </section>
    {#if pageCount > 1}
      <nav class="pagination" aria-label={t('admin.users.title')}>
        <button class="secondary" type="button" disabled={offset === 0 || loading} onclick={() => loadUsers(Math.max(0, offset - PAGE_SIZE))}>{t('admin.users.previous')}</button>
        <span class="muted">{t('admin.users.page', { page: pageNumber })} / {pageCount}</span>
        <button class="secondary" type="button" disabled={offset + PAGE_SIZE >= total || loading} onclick={() => loadUsers(offset + PAGE_SIZE)}>{t('admin.users.next')}</button>
      </nav>
    {/if}
  {/if}
</main>
<AppNav />

<style>
  .search { display: grid; gap: .4rem; margin: 1rem 0; }
  .search label { color: var(--muted); font-size: var(--t-sm); }
  .search-row { display: flex; align-items: center; gap: .5rem; }
  .search-row input { flex: 1; min-width: 0; }
  .search-row button.primary { flex: none; width: auto; }
  .search-row button, .pagination button, .message button { min-height: 46px; }
  .count { margin: .5rem 0 .75rem; font-size: var(--t-sm); }
  .user-list { display: grid; gap: .65rem; margin-bottom: 1.25rem; }
  .user-row { padding: .9rem 1rem; min-width: 0; }
  .identity { display: flex; align-items: center; justify-content: space-between; gap: .6rem; }
  .identity h2 { min-width: 0; overflow-wrap: anywhere; font-size: var(--t-base); margin: 0; }
  .admin-tag { flex: none; border-radius: 99px; background: var(--accent-soft); color: var(--accent-hi); padding: .2rem .55rem; font-size: var(--t-xs); }
  .email { color: var(--muted); font-size: var(--t-sm); overflow-wrap: anywhere; margin: .2rem 0 .75rem; }
  .dates { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; margin: 0; padding-top: .65rem; border-top: 1px solid var(--line); }
  .dates div { min-width: 0; }
  .dates dt { color: var(--faint); font-size: var(--t-xs); }
  .dates dd { margin: .15rem 0 0; font-size: var(--t-sm); overflow-wrap: anywhere; }
  .message { display: grid; justify-items: center; gap: .8rem; padding: 1.5rem 1rem; text-align: center; }
  .message p { margin: 0; }
  .pagination { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-bottom: 6rem; }
  .pagination button { min-width: 44px; padding-inline: .75rem; }
  .pagination span { text-align: center; font-size: var(--t-sm); }
  .skeleton { height: 118px; background: linear-gradient(90deg, var(--surface) 20%, var(--surface-hi) 45%, var(--surface) 70%); background-size: 200% 100%; animation: shimmer 1.3s ease-in-out infinite; }
  @keyframes shimmer { to { background-position-x: -200%; } }
  @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
</style>
