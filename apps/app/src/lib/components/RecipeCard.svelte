<script lang="ts">
  import { t } from '#lib/i18n';
  import type { RecipeSummaryDto } from '@gym-up/contracts';
  import { num, recipePhotoUrl } from '#lib/recipes';
  import Icon from './Icon.svelte';

  let { recipe }: { recipe: RecipeSummaryDto } = $props();

  let src = $state<string | null>(null);
  let failed = $state(false);

  $effect(() => {
    const { id, coverPhotoId } = recipe;
    if (!coverPhotoId) return;
    let live = true;
    recipePhotoUrl(id, coverPhotoId)
      .then((url) => live && (src = url))
      .catch(() => live && (failed = true));
    return () => {
      live = false;
    };
  });

  const meta = $derived(
    [
      recipe.totalMinutes !== null ? t('recipes.minutes', { n: recipe.totalMinutes }) : null,
      recipe.macros ? t('recipes.kcal', { n: Math.round(recipe.macros.calories) }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
  );
</script>

<a class="rc" href={`/nutrition/recipes/${recipe.id}`}>
  <div class="shot">
    {#if src && !failed}
      <img src={src} alt={t('recipes.photoAlt', { title: recipe.title })} loading="lazy" decoding="async" />
    {:else}
      <span class="ph"><Icon name="utensils" size={22} /></span>
    {/if}
    {#if recipe.ratingAverage !== null}
      <span class="rate" aria-label={t('recipes.ratingAria', { avg: num(recipe.ratingAverage, 1) })}>
        ★ {num(recipe.ratingAverage, 1)}
      </span>
    {/if}
    {#if !recipe.coverPhotoId}
      <span class="draft">{t('recipes.draft')}</span>
    {/if}
  </div>
  <div class="body">
    <strong>{recipe.title}</strong>
    {#if meta}<span class="meta">{meta}</span>{/if}
    {#if recipe.macros}
      <span class="meta prot">{t('recipes.proteinG', { n: num(recipe.macros.protein) })}</span>
    {:else}
      <span class="meta">{t('recipes.noMacros')}</span>
    {/if}
    {#if recipe.isMine}
      <span class="meta mine">
        {t('recipes.mine')}{#if recipe.ratingCount === 0}{' · '}{t('recipes.unrated')}{/if}
      </span>
    {/if}
  </div>
</a>

<style>
  .rc {
    display: block;
    min-width: 0;
    text-decoration: none;
    color: var(--text);
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: 0 0 0 1px var(--line);
    overflow: hidden;
    transition: background-color 160ms var(--ease);
  }
  .rc:active {
    background: var(--surface-hi);
  }
  .shot {
    position: relative;
    height: 104px;
    background: var(--surface-hi);
  }
  .shot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .ph {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--faint);
  }
  .rate,
  .draft {
    position: absolute;
    top: 0.4rem;
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: rgb(14 14 16 / 0.82);
    font-size: 11px;
    font-weight: 600;
  }
  .rate {
    right: 0.4rem;
    color: var(--ember);
  }
  .draft {
    left: 0.4rem;
    color: var(--accent-hi);
  }
  .body {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
    padding: 0.5rem 0.6rem 0.6rem;
  }
  strong {
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .meta {
    color: var(--muted);
    font-size: var(--t-xs);
  }
  .prot {
    color: var(--ok);
  }
  .mine {
    color: var(--faint);
  }
</style>
