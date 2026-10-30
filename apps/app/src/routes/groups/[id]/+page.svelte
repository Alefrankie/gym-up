<script lang="ts">
  import { t, tn, dateLocale } from '#lib/i18n';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { groupDetailSchema, type GroupDetailDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import Icon from '#lib/components/Icon.svelte';

  const id = $derived(page.params.id ?? '');
  let detail = $state<GroupDetailDto | null>(null);
  let error = $state<string | null>(null);
  let copied = $state(false);
  let busy = $state(false);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      detail = (await cachedGet(`/groups/${id}`, groupDetailSchema, { onCached: (c) => (detail = c.data) })).data;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('groups.offlineGroup')
          : e instanceof ApiRequestError && e.status === 404
            ? t('groups.notFound')
            : t('groups.loadGroupError');
    }
  });

  async function copy() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.group.code);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      /* clipboard can be unavailable in a WebView; the code is on screen anyway */
    }
  }

  async function leave() {
    if (!confirm(t('groups.confirmLeave'))) return;
    busy = true;
    try {
      await api(`/groups/${id}/members/me`, { method: 'DELETE' });
      await invalidateCache(['/groups']);
      await goto('/groups');
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : t('groups.leaveNeedsConnection');
      busy = false;
    }
  }

  const fmt = (d: string | null) =>
    d ? new Date(d + 'T00:00:00Z').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }) : t('groups.noWorkoutYet');
</script>

<main>
  <p><a class="back" href="/groups"><Icon name="left" size={18} /> {t('nav.groups')}</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !detail && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if detail}
    <h1>{detail.group.name}</h1>

    <section class="card hero invite">
      <span class="muted">{t('groups.inviteCode')}</span>
      <strong class="code">{detail.group.code}</strong>
      <button onclick={copy}><Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? t('groups.copied') : t('groups.copyCode')}</button>
    </section>

    <h2>{t('groups.membersTitle')}</h2>
    <ul class="list">
      {#each detail.members as m, i (m.id)}
        <li>
          <a href={`/groups/member/${m.id}`}>
            <span class="rank">{i + 1}</span>
            <Avatar name={m.displayName} size={34} />
            <span class="grow">
              <strong>{m.displayName}{m.id === session.user?.id ? t('groups.you') : ''}</strong>
              <span class="muted">{tn('groups.workouts', m.totalWorkouts)} · {t('groups.last', { date: fmt(m.lastWorkout) })}</span>
            </span>
            <span class="streak" class:on={m.currentStreak > 0}>
              <Icon name="flame" size={16} />{m.currentStreak}
            </span>
          </a>
        </li>
      {/each}
    </ul>

    <button class="danger" disabled={busy} onclick={leave}>{t('groups.leave')}</button>
  {/if}
</main>

<AppNav />

<style>
  .invite {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    text-align: center;
  }
  .invite .muted {
    font-size: var(--t-sm);
  }
  /* The invite code is read aloud and typed elsewhere: big, spaced, numeral face. */
  .code {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--t-num);
    letter-spacing: 0.18em;
    padding-left: 0.18em;
    line-height: 1;
  }
  .invite button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--t-sm);
  }
  .rank {
    width: 1rem;
    text-align: center;
    color: var(--faint);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    color: var(--faint);
    font-size: var(--t-base);
    font-weight: 600;
  }
  .streak.on {
    color: var(--ember);
  }
</style>
