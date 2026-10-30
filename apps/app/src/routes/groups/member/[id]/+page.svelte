<script lang="ts">
  import { t, dateLocale } from '#lib/i18n';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { memberProfileSchema, type MemberProfileDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import Icon from '#lib/components/Icon.svelte';

  let member = $state<MemberProfileDto | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      member = (await cachedGet(`/groups/members/${page.params.id}`, memberProfileSchema, { onCached: (c) => (member = c.data) })).data;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('groups.offlineMember')
          : e instanceof ApiRequestError && e.status === 404
            ? t('groups.memberForbidden')
            : t('groups.loadMemberError');
    }
  });

  const fmt = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
</script>

<main>
  <p><button class="ghost back" onclick={() => history.back()}><Icon name="left" size={18} /> {t('common.back')}</button></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !member && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if member}
    <header class="who">
      <Avatar name={member.profile.displayName} size={48} />
      <h1>{member.profile.displayName}</h1>
    </header>

    <section class="card hero stats">
      <div>
        <span class="big-number">{member.stats.totalWorkouts}</span>
        <span class="muted">{t('groups.workoutsLabel')}</span>
      </div>
      <div>
        <span class="big-number streak"><Icon name="flame" size={20} />{member.stats.currentStreak}</span>
        <span class="muted">{t('groups.streakLabel')}</span>
      </div>
    </section>

    <h2>{t('groups.workoutsTitle')}</h2>
    {#if member.workouts.length === 0}
      <p class="muted">{t('groups.memberNoWorkouts')}</p>
    {:else}
      <ul class="list">
        {#each member.workouts as w (w.id)}
          <li>
            <div class="row-body">
              <span class="ok-ico"><Icon name="check" size={16} /></span>
              <span class="grow">{fmt(w.workoutDate)}</span>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</main>

<AppNav />

<style>
  .who {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .who h1 {
    margin: 0;
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    text-align: center;
  }
  .stats div {
    display: grid;
    gap: 0.3rem;
  }
  .stats div + div {
    border-left: 1px solid var(--line);
  }
  .stats .muted {
    font-size: var(--t-sm);
  }
  .ok-ico {
    display: grid;
    color: var(--ok);
  }
  .list li > .row-body {
    min-height: 48px;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    color: var(--ember);
  }
  .back {
    padding-left: 0;
  }
</style>
