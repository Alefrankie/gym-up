<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { communityMemberListSchema, type CommunityMemberDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import { day } from '#lib/community';
  import AppNav from '#lib/components/AppNav.svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import Icon from '#lib/components/Icon.svelte';

  let members = $state<CommunityMemberDto[] | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      members = (await cachedGet('/community/members', communityMemberListSchema, { onCached: (c) => (members = c.data.items) })).data.items;
    } catch (e) {
      error = e instanceof NetworkError ? t('community.offlineEmpty') : e instanceof ApiRequestError ? e.message : t('community.loadError');
    }
  });
</script>

<main>
  <p><button class="ghost back" onclick={() => history.back()}><Icon name="left" size={18} /> {t('common.back')}</button></p>
  <h1>{t('community.members')}</h1>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !members && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if members}
    <ul class="list">
      {#each members as m (m.id)}
        <li>
          <a class="row-body" href="/community/members/{m.id}">
            <Avatar name={m.displayName} size={40} />
            <span class="grow">
              <strong>{m.displayName}{#if m.id === session.user?.id}<span class="muted">{' · '}{t('community.you')}</span>{/if}</strong>
              <span class="muted">
                {m.totalWorkouts ? tn('community.workouts', m.totalWorkouts) : t('community.noWorkoutYet')}{#if m.lastWorkout}{' · '}{t('community.last', { date: day(m.lastWorkout, { day: 'numeric', month: 'short' }) })}{/if}
              </span>
            </span>
            <span class="chev"><Icon name="right" size={16} /></span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<AppNav />

<style>
  .back {
    padding-left: 0;
  }
  .row-body {
    min-height: 64px;
    color: var(--text);
    text-decoration: none;
  }
  .grow {
    display: grid;
    gap: 0.15rem;
  }
  .grow .muted {
    font-size: var(--t-sm);
  }
  strong {
    font-weight: 600;
  }
  .chev {
    color: var(--faint);
  }
</style>
