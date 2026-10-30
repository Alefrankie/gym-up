<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { groupListResponseSchema, groupSummarySchema, type GroupSummaryDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';

  let groups = $state<GroupSummaryDto[] | null>(null);
  let stale = $state(false);
  let error = $state<string | null>(null);
  let formError = $state<string | null>(null);
  let busy = $state(false);
  let newName = $state('');
  let code = $state('');

  async function load() {
    try {
      const res = await cachedGet('/groups', groupListResponseSchema, { onCached: (c) => (groups = c.data.items) });
      groups = res.data.items;
      stale = res.stale;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('groups.offlineEmpty')
          : e instanceof ApiRequestError
            ? e.message
            : t('groups.loadError');
    }
  }

  onMount(async () => {
    if (await session.require()) await load();
  });

  async function submit(path: string, body: unknown) {
    busy = true;
    formError = null;
    try {
      const g = await api(path, { method: 'POST', body, schema: groupSummarySchema });
      await invalidateCache(['/groups']);
      await goto(`/groups/${g.id}`);
    } catch (e) {
      formError =
        e instanceof NetworkError
          ? t('common.needsConnection')
          : e instanceof ApiRequestError
            ? e.status === 404
              ? t('groups.codeNotFound')
              : e.message
            : t('groups.actionError');
      busy = false;
    }
  }
</script>

<main>
  <h1>{t('nav.groups')}</h1>
  <SyncBanner />
  {#if stale}<p class="muted">{t('groups.stale')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if !groups && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if groups}
    {#if groups.length === 0}
      <section class="card hero intro">
        <h2>{t('groups.introTitle')}</h2>
        <p class="muted">
          {t('groups.introBody')}
        </p>
      </section>
    {:else}
      <ul class="list">
        {#each groups as g (g.id)}
          <li>
            <a href={`/groups/${g.id}`}>
              <span class="tile"><Icon name="users" size={18} /></span>
              <span class="grow">
                <strong>{g.name}</strong>
                <span class="muted">{tn('groups.members', g.memberCount)}</span>
              </span>
              <span class="chev"><Icon name="right" size={16} /></span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}

    <section class="card">
      <h3>{t('groups.createTitle')}</h3>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          void submit('/groups', { id: crypto.randomUUID(), name: newName });
        }}
      >
        <label>
          {t('auth.name')}
          <input required minlength="2" maxlength="40" placeholder={t('groups.namePlaceholder')} bind:value={newName} />
        </label>
        <button class="primary" disabled={busy}>{t('groups.create')}</button>
      </form>
    </section>

    <section class="card">
      <h3>{t('groups.joinTitle')}</h3>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          void submit('/groups/join', { code });
        }}
      >
        <label>
          {t('groups.codeLabel')}
          <input
            required
            minlength="6"
            maxlength="6"
            autocapitalize="characters"
            autocomplete="off"
            class="code"
            placeholder="K7M2QX"
            bind:value={code}
          />
        </label>
        <button class="primary" disabled={busy}>{t('groups.join')}</button>
      </form>
    </section>
    {#if formError}<p class="error" role="alert">{formError}</p>{/if}
  {/if}
</main>

<AppNav />

<style>
  .intro h2 {
    margin: 0 0 0.35rem;
  }
  .intro p {
    margin: 0;
    font-size: var(--t-sm);
  }
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    color: var(--muted);
  }
  .chev {
    display: grid;
    color: var(--faint);
  }
  section.card h3 {
    margin-bottom: 0.6rem;
  }
  /* Join codes are entered as capitals; the transform keeps typing feedback honest. */
  .code {
    font-size: var(--t-md);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: center;
  }
</style>
