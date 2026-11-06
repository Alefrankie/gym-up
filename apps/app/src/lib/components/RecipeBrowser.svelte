<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { onMount } from 'svelte';
  import { recipePageSchema, type RecipeSummaryDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import Icon from './Icon.svelte';
  import RecipeCard from './RecipeCard.svelte';

  let items = $state<RecipeSummaryDto[] | null>(null);
  let next = $state<string | null>(null);
  let stale = $state(false);
  let error = $state<string | null>(null);
  let loadingMore = $state(false);
  let ready = $state(false);

  let q = $state('');
  let quick = $state(false);
  let protein = $state(false);

  // Reading the filters here is what makes the effect rerun when one changes.
  const filterKey = $derived(`${q.trim()}|${quick}|${protein}`);
  const filtered = $derived(!!q.trim() || quick || protein);

  function path(cursor?: string): string {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (quick) params.set('maxMinutes', '15');
    if (protein) params.set('tag', 'alto-proteina');
    if (cursor) params.set('cursor', cursor);
    const query = params.toString();
    return query ? `/recipes?${query}` : '/recipes';
  }

  const message = (e: unknown): string =>
    e instanceof NetworkError
      ? t('recipes.offlineEmpty')
      : e instanceof ApiRequestError
        ? e.message
        : t('recipes.loadError');

  // Only the newest request may paint: typing fast must not leave an older answer on screen.
  let seq = 0;
  async function load() {
    const mine = ++seq;
    error = null;
    try {
      const res = await cachedGet(path(), recipePageSchema, {
        onCached: (c) => {
          if (mine !== seq) return;
          items = c.data.items;
          next = c.data.nextCursor;
        },
      });
      if (mine !== seq) return;
      items = res.data.items;
      next = res.data.nextCursor;
      stale = res.stale;
    } catch (e) {
      if (mine !== seq) return;
      items = [];
      error = message(e);
    }
  }

  let firstLoad = true;
  $effect(() => {
    void filterKey;
    if (!ready) return;
    // The first page paints at once; typing waits for a pause.
    if (firstLoad) {
      firstLoad = false;
      void load();
      return;
    }
    const id = setTimeout(() => void load(), 300);
    return () => clearTimeout(id);
  });

  onMount(async () => {
    if (!(await session.require())) return;
    ready = true;
  });

  async function more() {
    if (!next || loadingMore) return;
    loadingMore = true;
    try {
      const res = await api(path(next), { schema: recipePageSchema });
      const seen = new Set(items?.map((r) => r.id));
      items = [...(items ?? []), ...res.items.filter((r) => !seen.has(r.id))];
      next = res.nextCursor;
    } catch (e) {
      error = e instanceof NetworkError ? t('common.needsConnection') : t('recipes.loadError');
    } finally {
      loadingMore = false;
    }
  }

  function reset() {
    q = '';
    quick = false;
    protein = false;
  }
</script>

<form class="search" role="search" onsubmit={(e) => e.preventDefault()}>
  <Icon name="search" size={18} />
  <input type="search" bind:value={q} placeholder={t('recipes.searchPlaceholder')} aria-label={t('recipes.searchPlaceholder')} />
</form>

<div class="chips">
  <button type="button" class="chip" class:on={!filtered} aria-pressed={!filtered} onclick={reset}>
    {t('recipes.filterAll')}
  </button>
  <button type="button" class="chip" class:on={quick} aria-pressed={quick} onclick={() => (quick = !quick)}>
    {t('recipes.filterQuick')}
  </button>
  <button type="button" class="chip" class:on={protein} aria-pressed={protein} onclick={() => (protein = !protein)}>
    {t('recipes.filterProtein')}
  </button>
</div>

{#if stale}<p class="muted stale">{t('common.offline')}</p>{/if}
{#if error}<p class="error" role="alert">{error}</p>{/if}

{#if !items && !error}
  <p class="muted loading">{t('common.loading')}</p>
{:else if items}
  <div class="sect">
    <h2>{tn('recipes.count', items.length)}</h2>
    <span class="muted">{t('recipes.recent')}</span>
  </div>

  {#if items.length === 0}
    <p class="muted empty">{filtered ? t('recipes.emptyFiltered') : t('recipes.empty')}</p>
  {/if}

  <div class="grid">
    {#each items as recipe (recipe.id)}
      <RecipeCard {recipe} />
    {/each}
    <a class="new" href="/nutrition/recipes/new">
      <span class="plus"><Icon name="plus" size={22} /></span>
      <span>{t('recipes.new')}</span>
      <span class="hint">{t('recipes.newHint')}</span>
    </a>
  </div>

  {#if next}
    <button class="more" disabled={loadingMore} onclick={more}>
      {loadingMore ? t('common.loading') : t('recipes.more')}
    </button>
  {/if}
{/if}

<style>
  .search {
    position: relative;
    display: block;
    margin-bottom: 0.7rem;
  }
  .search :global(svg) {
    position: absolute;
    left: 0.7rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--faint);
    pointer-events: none;
  }
  .search input {
    width: 100%;
    padding-left: 2.2rem;
  }
  .chips {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    scrollbar-width: none;
    margin-bottom: 1.1rem;
    padding-bottom: 0.1rem;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  .chips .chip {
    flex: none;
    white-space: nowrap;
  }
  .sect {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0 0 0.6rem;
  }
  .sect h2 {
    margin: 0;
  }
  .sect .muted {
    font-size: var(--t-sm);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }
  .new {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.3rem;
    min-height: 182px;
    padding: 0.75rem;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
    text-align: center;
    text-decoration: none;
  }
  .new .plus {
    color: var(--accent);
    line-height: 1;
  }
  .new .hint {
    color: var(--faint);
    font-size: var(--t-xs);
    font-weight: 400;
  }
  .more {
    width: 100%;
    min-height: 48px;
    margin-top: 0.9rem;
  }
  .empty {
    margin: 0 0 0.9rem;
  }
  .stale {
    margin: 0 0 0.6rem;
    font-size: var(--t-sm);
  }
</style>
