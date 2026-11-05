<script lang="ts">
  import { t } from '#lib/i18n';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { communityPageSchema, communityProfileSchema, type CommunityProfileDto, type CommunityWorkoutDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import { day, today, volume } from '#lib/community';
  import { exerciseName } from '#lib/exercise-name';
  import AppNav from '#lib/components/AppNav.svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import WorkoutCard from '#lib/components/WorkoutCard.svelte';

  let profile = $state<CommunityProfileDto | null>(null);
  let workouts = $state<CommunityWorkoutDto[] | null>(null);
  let next = $state<string | null>(null);
  let error = $state<string | null>(null);
  let loadingMore = $state(false);

  const id = $derived(page.params.id!);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const [p, w] = await Promise.all([
        cachedGet(`/community/members/${id}?today=${today()}`, communityProfileSchema, { onCached: (c) => (profile = c.data) }),
        cachedGet(`/community/members/${id}/workouts`, communityPageSchema, { onCached: (c) => ((workouts = c.data.items), (next = c.data.nextCursor)) }),
      ]);
      profile = p.data;
      workouts = w.data.items;
      next = w.data.nextCursor;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('community.offlineEmpty')
          : e instanceof ApiRequestError && e.status === 404
            ? t('community.profileMissing')
            : t('community.profileError');
    }
  });

  async function more() {
    if (!next || loadingMore) return;
    loadingMore = true;
    try {
      const res = await api(`/community/members/${id}/workouts?cursor=${encodeURIComponent(next)}`, { schema: communityPageSchema });
      workouts = [...(workouts ?? []), ...res.items];
      next = res.nextCursor;
    } catch {
      error = t('common.needsConnection');
    } finally {
      loadingMore = false;
    }
  }

  const reps = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);
  const hasPrevious = $derived(!!profile && profile.lastWeek.sessions > 0);
</script>

<main>
  <p><button class="ghost back" onclick={() => history.back()}><Icon name="left" size={18} /> {t('common.back')}</button></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if !profile && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if profile}
    <header class="who">
      <Avatar name={profile.member.displayName} size={56} />
      <div>
        <h1>{profile.member.displayName}</h1>
        {#if profile.isMe}<p class="muted">{t('community.you')}</p>{/if}
      </div>
    </header>

    <section aria-labelledby="week-title">
      <h2 id="week-title">{t('community.week')}</h2>
      <p class="muted range">{t('community.weekRange', { start: day(profile.thisWeek.start, { day: 'numeric', month: 'short' }), end: day(profile.thisWeek.end, { day: 'numeric', month: 'short' }) })}</p>
      <table class="week">
        <thead>
          <tr><th scope="col"><span class="sr">—</span></th><th scope="col">{t('community.week')}</th><th scope="col">{t('community.lastWeek')}</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{t('community.sessions')}</th>
            <td class="now">{profile.thisWeek.sessions}</td>
            <td>{hasPrevious ? profile.lastWeek.sessions : '—'}</td>
          </tr>
          <tr>
            <th scope="row">{t('community.setsLabel')}</th>
            <td class="now">{profile.thisWeek.sets}</td>
            <td>{hasPrevious ? profile.lastWeek.sets : '—'}</td>
          </tr>
          <tr>
            <th scope="row">{t('community.volumeLabel')}</th>
            <td class="now">{volume(profile.thisWeek.volumeKg)}</td>
            <td>{hasPrevious ? volume(profile.lastWeek.volumeKg) : '—'}</td>
          </tr>
        </tbody>
      </table>
      {#if !hasPrevious}<p class="muted note">{t('community.noCompare')}</p>{/if}
    </section>

    <section aria-labelledby="routine-title">
      <h2 id="routine-title">{t('community.routine')}</h2>
      {#if profile.routine}
        <p class="routine-name">{profile.routine.name}</p>
        <div class="days">
          {#each profile.routine.days as d, i (i)}
            <details>
              <summary>
                <span class="grow"><strong>{d.dayName}</strong><span class="muted">{d.focus}</span></span>
                <span class="chev"><Icon name="down" size={16} /></span>
              </summary>
              <ul>
                {#each d.exercises as e, j (j)}
                  <li><span>{exerciseName(e.name)}</span><span class="num">{t('community.setsReps', { sets: e.sets, reps: reps(e.repsMin, e.repsMax) })}</span></li>
                {/each}
              </ul>
            </details>
          {/each}
        </div>
      {:else}
        <p class="muted">{t('community.noRoutine')}</p>
      {/if}
    </section>

    <section aria-labelledby="supp-title">
      <h2 id="supp-title">{t('community.supplements')}</h2>
      {#if profile.supplements.length}
        <ul class="chips">
          {#each profile.supplements as s, i (i)}<li class="chip">{s}</li>{/each}
        </ul>
      {:else}
        <p class="muted">{t('community.noSupplements')}</p>
      {/if}
    </section>

    <section aria-labelledby="history-title">
      <h2 id="history-title">{t('community.history')}</h2>
      {#if workouts && workouts.length === 0}
        <p class="muted">{t('community.noHistory')}</p>
      {:else if workouts}
        <div class="feed">
          {#each workouts as w (w.id)}
            <WorkoutCard workout={w} showAuthor={false} />
          {/each}
        </div>
        {#if next}
          <button class="more" disabled={loadingMore} onclick={more}>{loadingMore ? t('common.loading') : t('community.more')}</button>
        {/if}
      {/if}
    </section>
  {/if}
</main>

<AppNav />

<style>
  .back {
    padding-left: 0;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: 0.5rem;
  }
  .who h1,
  .who p {
    margin: 0;
  }
  section {
    margin-top: 2rem;
  }
  section h2 {
    margin-bottom: 0.25rem;
  }
  .range,
  .note {
    margin: 0 0 0.75rem;
    font-size: var(--t-sm);
  }
  .note {
    margin-top: 0.5rem;
  }
  .week {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  .week th,
  .week td {
    padding: 0.7rem 0;
    text-align: right;
    border-bottom: 1px solid var(--line);
  }
  .week thead th {
    color: var(--muted);
    font-size: var(--t-xs);
    font-weight: 500;
    padding-top: 0;
  }
  .week th[scope='row'],
  .week thead th:first-child {
    text-align: left;
    font-weight: 500;
    color: var(--muted);
  }
  .week td {
    color: var(--muted);
  }
  .week td.now {
    color: var(--text);
    font-family: var(--font-display);
    font-size: 1.375rem;
    font-weight: 700;
    padding-right: 1.25rem;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .routine-name {
    margin: 0 0 0.75rem;
    color: var(--muted);
  }
  .days {
    display: grid;
    border-top: 1px solid var(--line);
  }
  details {
    border-bottom: 1px solid var(--line);
  }
  summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 56px;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary .grow {
    display: grid;
  }
  summary .muted {
    font-size: var(--t-sm);
  }
  .chev {
    color: var(--faint);
    transition: transform 200ms var(--ease);
  }
  details[open] .chev {
    transform: rotate(180deg);
  }
  details ul {
    list-style: none;
    margin: 0;
    padding: 0 0 0.75rem;
  }
  details li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.35rem 0;
    font-size: var(--t-sm);
  }
  .num {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
  }
  .feed {
    display: grid;
    gap: 1rem;
    margin-top: 0.75rem;
  }
  .more {
    width: 100%;
    margin-top: 1rem;
    min-height: 48px;
  }
  @media (prefers-reduced-motion: reduce) {
    .chev {
      transition: none;
    }
  }
</style>
