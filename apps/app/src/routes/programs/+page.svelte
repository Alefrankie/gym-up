<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { programListResponseSchema, type ProgramListResponse, type ProgramSummaryDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import NewProgramSheet from '#lib/components/NewProgramSheet.svelte';
  import ProgramThumb from '#lib/components/ProgramThumb.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';

  let data = $state<ProgramListResponse | null>(null);
  let error = $state<string | null>(null);
  let stale = $state(false);
  let creating = $state(false);
  let q = $state('');
  let filter = $state<'all' | 'mine' | 'templates'>('all');

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const res = await cachedGet('/programs', programListResponseSchema, { onCached: (c) => (data = c.data) });
      data = res.data;
      stale = res.stale;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('programs.offlineEmpty')
          : e instanceof ApiRequestError
            ? e.message
            : t('programs.loadError');
    }
  });

  const goal = (g: string): string => ({ hypertrophy: t('programs.goal.hypertrophy'), strength: t('programs.goal.strength'), general: t('programs.goal.general') })[g] ?? g;
  const level = (l: string): string =>
    ({ beginner: t('programs.level.beginner'), intermediate: t('programs.level.intermediate'), advanced: t('programs.level.advanced') })[l] ?? l;
  const meta = (p: ProgramSummaryDto) =>
    [
      tn('programs.days', p.routineCount),
      p.exerciseCount ? tn('programs.exercises', p.exerciseCount) : null,
      p.level && level(p.level),
      p.goal && goal(p.goal),
    ]
      .filter(Boolean)
      .join(' · ');

  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const match = (p: ProgramSummaryDto) => !q || norm(p.name).includes(norm(q));
  // The active program leads the list; the rest of yours follow, then the templates.
  const mine = $derived(
    [...(data?.mine ?? [])].sort((a, b) => Number(b.id === data?.activeProgramId) - Number(a.id === data?.activeProgramId)).filter(match),
  );
  const templates = $derived((data?.templates ?? []).filter(match));
</script>

<main>
  <header class="top">
    <h1>{t('nav.train')}</h1>
    <button type="button" class="icon add" aria-label={t('programs.new')} onclick={() => (creating = true)}><Icon name="plus" size={20} /></button>
  </header>
  <SyncBanner />
  {#if stale}<p class="muted">{t('programs.stale')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <label class="search">
    <Icon name="search" size={18} />
    <input type="search" placeholder={t('programs.search')} aria-label={t('programs.search')} bind:value={q} />
  </label>

  <div class="chips" role="group" aria-label={t('programs.filter')}>
    <button type="button" class="chip" class:on={filter === 'all'} aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>{t('programs.filterAll')}</button>
    <button type="button" class="chip" class:on={filter === 'mine'} aria-pressed={filter === 'mine'} onclick={() => (filter = 'mine')}>{t('programs.mine')}</button>
    <button type="button" class="chip" class:on={filter === 'templates'} aria-pressed={filter === 'templates'} onclick={() => (filter = 'templates')}>{t('programs.templates')}</button>
    <a class="chip" href="/library"><Icon name="book" size={14} /> {t('programs.exercisesLink')}</a>
  </div>

  {#if !data && !error}
    <p class="muted loading">{t('common.loading')}</p>
  {:else if data}
    {#snippet row(p: ProgramSummaryDto)}
      <li>
        <a class="row" href={`/programs/${p.id}`}>
          <ProgramThumb muscles={p.muscles} />
          <span class="grow">
            <strong>{p.name}</strong>
            <span class="muted">{meta(p)}</span>
            {#if p.id === data?.activeProgramId}<span class="active"><span class="dot"></span>{t('programs.active')}</span>{/if}
          </span>
          <Icon name="right" size={18} />
        </a>
      </li>
    {/snippet}

    {#if filter !== 'templates'}
      <h2>{t('programs.mine')}</h2>
      {#if mine.length}
        <ul class="rows">{#each mine as p (p.id)}{@render row(p)}{/each}</ul>
      {:else if !q}
        <button type="button" class="empty" onclick={() => (creating = true)}>
          <Icon name="plus" size={18} /> {t('programs.emptyMine')}
        </button>
      {:else}
        <p class="muted">{t('programs.noMatch')}</p>
      {/if}
    {/if}

    {#if filter !== 'mine'}
      <h2>{t('programs.templates')}</h2>
      <ul class="rows">{#each templates as p (p.id)}{@render row(p)}{/each}</ul>
    {/if}
  {/if}
</main>

{#if creating && data}
  <NewProgramSheet templates={data.templates} onclose={() => (creating = false)} />
{/if}

<AppNav />

<style>
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .add {
    border-radius: 50%;
    color: var(--accent-hi);
  }
  .search {
    position: relative;
    display: flex;
    align-items: center;
    color: var(--muted);
  }
  .search :global(svg) {
    position: absolute;
    left: 0.85rem;
  }
  .search input {
    flex: 1;
    min-height: 44px;
    padding-left: 2.6rem;
    border-radius: 999px;
  }
  .chips {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    margin: 0.75rem -1rem 0;
    padding: 0 1rem;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chips .chip {
    flex: none;
    text-decoration: none;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    min-height: 76px;
    padding: 0.35rem 0;
    border-radius: var(--radius);
    color: var(--text);
    text-decoration: none;
    transition: background-color 160ms var(--ease);
  }
  .row:active {
    background: var(--surface);
  }
  .row > :global(svg:last-child) {
    flex: none;
    color: var(--faint);
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.15rem;
  }
  .grow strong {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .grow .muted {
    font-size: var(--t-sm);
  }
  .active {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--accent-hi);
    font-size: var(--t-xs);
    font-weight: 600;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }
  .empty {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 56px;
    background: none;
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--muted);
    font-size: var(--t-sm);
  }
</style>
