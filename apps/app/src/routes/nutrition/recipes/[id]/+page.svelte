<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import {
    logRecipeResponseSchema,
    recipeDetailSchema,
    recipeLikeStateSchema,
    recipeRatingStatesSchema,
    type RecipeDetailDto,
  } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import { amount, newLogAttempt, num, recipePhotoUrl, relativeWhen, scaled, sendLogAttempt, tagKey, type RecipeLogAttempt } from '#lib/recipes';
  import AppNav from '#lib/components/AppNav.svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Sheet from '#lib/components/Sheet.svelte';
  import StarRating from '#lib/components/StarRating.svelte';

  const id = $derived(page.params.id!);

  let recipe = $state<RecipeDetailDto | null>(null);
  let error = $state<string | null>(null);
  let note = $state<string | null>(null);

  let cover = $state<string | null>(null);
  let coverFailed = $state(false);
  let stepPhotos = $state<Record<number, string>>({});

  /** Ingredient amounts follow the servings the cook picks; macros stay per serving. */
  let servings = $state(1);
  let sheet = $state(false);
  /** The attempt in the sheet: one id per opening, reused on every retry (see `sendLogAttempt`). */
  let attempt = $state<RecipeLogAttempt>(newLogAttempt());
  let logBusy = $state(false);
  let logError = $state<string | null>(null);
  let logged = $state(false);

  let ratingBusy = $state(false);
  let likeBusy = $state(false);

  const factor = $derived(recipe && recipe.servings > 0 ? servings / recipe.servings : 1);
  const substitutes = $derived(recipe?.ingredients.reduce((n, i) => n + i.substitutes.length, 0) ?? 0);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      // Cached, so a recipe opened once still reads in a kitchen with no signal.
      const res = await cachedGet(`/recipes/${id}`, recipeDetailSchema, { onCached: (c) => (recipe = c.data) });
      recipe = res.data;
      servings = res.data.servings;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? t('recipes.offlineEmpty')
          : e instanceof ApiRequestError && e.status === 404
            ? t('recipes.notFound')
            : t('recipes.loadOneError');
    }
  });

  $effect(() => {
    const r = recipe;
    if (!r?.coverPhotoId) {
      cover = null;
      return;
    }
    let live = true;
    recipePhotoUrl(r.id, r.coverPhotoId)
      .then((url) => live && (cover = url))
      .catch(() => live && (coverFailed = true));
    return () => {
      live = false;
    };
  });

  $effect(() => {
    const r = recipe;
    if (!r) return;
    let live = true;
    for (const step of r.steps) {
      if (!step.photoId) continue;
      recipePhotoUrl(r.id, step.photoId)
        .then((url) => {
          if (live) stepPhotos[step.order] = url;
        })
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  });

  async function rate(value: number) {
    if (!recipe || recipe.isMine || ratingBusy) return;
    if (!navigator.onLine) {
      note = t('recipes.ratingOffline');
      return;
    }
    const before = { ratingCount: recipe.ratingCount, ratingAverage: recipe.ratingAverage, viewerRating: recipe.viewerRating };
    // Optimistic: the stars answer the tap; the server's numbers replace this a moment later.
    const count = before.ratingCount + (before.viewerRating === null ? 1 : 0);
    const total = (before.ratingAverage ?? 0) * before.ratingCount - (before.viewerRating ?? 0) + value;
    recipe.viewerRating = value;
    recipe.ratingCount = count;
    recipe.ratingAverage = count > 0 ? total / count : null;
    ratingBusy = true;
    note = null;
    try {
      const state = await api(`/recipes/${recipe.id}/rating`, {
        method: 'PUT',
        body: { rating: value },
        schema: recipeRatingStatesSchema,
      });
      recipe.ratingCount = state.ratingCount;
      recipe.ratingAverage = state.ratingAverage;
      recipe.viewerRating = state.viewerRating;
      note = t('recipes.ratingSaved');
    } catch (e) {
      Object.assign(recipe, before);
      note = e instanceof ApiRequestError ? e.message : t('recipes.rateError');
    } finally {
      ratingBusy = false;
    }
  }

  async function toggleLike() {
    if (!recipe || recipe.isMine || likeBusy) return;
    if (!navigator.onLine) {
      note = t('recipes.likeOffline');
      return;
    }
    const before = { likeCount: recipe.likeCount, viewerHasLiked: recipe.viewerHasLiked };
    const liking = !recipe.viewerHasLiked;
    recipe.viewerHasLiked = liking;
    recipe.likeCount += liking ? 1 : -1;
    likeBusy = true;
    note = null;
    try {
      const state = await api(`/recipes/${recipe.id}/like`, {
        method: liking ? 'PUT' : 'DELETE',
        schema: recipeLikeStateSchema,
      });
      recipe.likeCount = state.likeCount;
      recipe.viewerHasLiked = state.viewerHasLiked;
    } catch (e) {
      Object.assign(recipe, before);
      note = e instanceof NetworkError ? t('recipes.likeOffline') : t('recipes.likeError');
    } finally {
      likeBusy = false;
    }
  }

  function openLog() {
    logged = false;
    logError = null;
    // A new opening is a new entry; a retry inside the same opening reuses this one.
    attempt = newLogAttempt();
    sheet = true;
  }

  async function addToToday() {
    if (!recipe || logBusy) return;
    if (!navigator.onLine) {
      logError = t('recipes.addOffline');
      return;
    }
    logBusy = true;
    logError = null;
    const id = recipe.id;
    try {
      await sendLogAttempt(attempt, (body) =>
        api(`/recipes/${id}/log`, { method: 'POST', body, schema: logRecipeResponseSchema }),
      );
      // The day screen reads from the cache, so the new meal must not be served from a stale copy.
      await invalidateCache(['/nutrition']);
      sheet = false;
      logged = true;
    } catch (e) {
      logError =
        e instanceof NetworkError
          ? t('recipes.addOffline')
          : e instanceof ApiRequestError && e.status === 409
            ? t('recipes.addNoMacros')
            : e instanceof ApiRequestError
              ? e.message
              : t('recipes.addError');
    } finally {
      logBusy = false;
    }
  }

  const clampServings = (value: number) => Math.max(0.5, Math.min(20, Math.round(value * 2) / 2));
</script>

{#if error}
  <main>
    <p><a class="back" href="/nutrition?tab=recetas"><Icon name="left" size={18} /> {t('recipes.tab.recipes')}</a></p>
    <p class="error" role="alert">{error}</p>
  </main>
{:else if !recipe}
  <main>
    <p class="muted loading">{t('common.loading')}</p>
  </main>
{:else}
  <div class="hero">
    {#if cover && !coverFailed}
      <img src={cover} alt={t('recipes.photoAlt', { title: recipe.title })} />
    {:else}
      <span class="hero-ph"><Icon name="utensils" size={30} /></span>
    {/if}
  </div>

  <main class="detail">
    <p class="backrow"><a class="back" href="/nutrition?tab=recetas"><Icon name="left" size={18} /> {t('recipes.tab.recipes')}</a></p>

    <h1>{recipe.title}</h1>
    <p class="byline">
      <Avatar name={recipe.author.displayName} size={26} />
      <span>{recipe.author.displayName} · {relativeWhen(recipe.createdAt)}</span>
    </p>

    {#if recipe.description}<p class="lead">{recipe.description}</p>{/if}

    {#if recipe.coverPhotoId === null}
      <p class="draft-note"><Icon name="alert" size={18} /> {t('recipes.draftNotice')}</p>
    {/if}

    <div class="rate-row">
      <StarRating
        value={recipe.ratingAverage}
        viewer={recipe.viewerRating}
        onrate={recipe.isMine ? undefined : rate}
        busy={ratingBusy}
      />
      <strong>{recipe.ratingAverage !== null ? num(recipe.ratingAverage, 1) : '—'}</strong>
      <span class="count">
        {#if recipe.ratingCount}{tn('recipes.ratingCount', recipe.ratingCount)}{:else}{t('recipes.unrated')}{/if}
        {#if !recipe.isMine}{' · '}{t('recipes.tapToRate')}{/if}
      </span>
    </div>

    {#if note}<p class="note" role="status">{note}</p>{/if}

    <div class="chips">
      {#if recipe.prepMinutes !== null}<span class="chip">{t('recipes.prep', { n: recipe.prepMinutes })}</span>{/if}
      {#if recipe.cookMinutes !== null}<span class="chip">{t('recipes.cook', { n: recipe.cookMinutes })}</span>{/if}
      <span class="chip">{tn('recipes.servings', recipe.servings)}</span>
      {#each recipe.tags as tag (tag)}
        <span class="chip">{t(tagKey(tag))}</span>
      {/each}
    </div>

    {#if recipe.macros}
      <section class="card macros">
        <div>
          <span class="n">{Math.round(recipe.macros.calories)}</span><span class="l">{t('recipes.macro.kcal')}</span>
        </div>
        <div>
          <span class="n">{Math.round(recipe.macros.protein)}<span class="u"> g</span></span>
          <span class="l">{t('recipes.macro.protein')}</span>
        </div>
        <div>
          <span class="n">{Math.round(recipe.macros.carbs)}<span class="u"> g</span></span>
          <span class="l">{t('recipes.macro.carbs')}</span>
        </div>
        <div>
          <span class="n">{Math.round(recipe.macros.fat)}<span class="u"> g</span></span>
          <span class="l">{t('recipes.macro.fat')}</span>
        </div>
      </section>
      <p class="fine">{t('recipes.perServing')}</p>
    {:else}
      <p class="fine">{t('recipes.noMacros')}</p>
    {/if}

    <div class="serv-head">
      <h2>{t('recipes.ingredients')}</h2>
      <div class="stepper">
        <button
          type="button"
          class="icon ghost"
          aria-label={t('recipes.decrease')}
          disabled={servings <= 1}
          onclick={() => (servings = Math.max(1, servings - 1))}><Icon name="down" size={16} /></button
        >
        <span>{t('recipes.servingsShort', { n: servings })}</span>
        <button
          type="button"
          class="icon ghost"
          aria-label={t('recipes.increase')}
          disabled={servings >= 20}
          onclick={() => (servings = Math.min(20, servings + 1))}><Icon name="up" size={16} /></button
        >
      </div>
    </div>

    <ul class="ing">
      {#each recipe.ingredients as ing (ing.id)}
        <li>
          <b>{amount(ing.quantity === null ? null : scaled(ing.quantity, factor), ing.unit, t('recipes.gusto'))}</b>
          <span>{ing.name}{#if ing.optional} <span class="opt">({t('recipes.optional')})</span>{/if}</span>
        </li>
        {#each ing.substitutes as sub (sub.id)}
          <li class="subst">
            <span class="q">{t('recipes.substituteQuestion', { name: ing.name })}</span>
            <span class="a">
              {sub.quantity !== null ? `${num(scaled(sub.quantity, factor), 1)}${sub.unit ? ` ${sub.unit}` : ''} · ` : ''}{sub.name}{#if sub.note}{` · ${sub.note}`}{/if}
            </span>
          </li>
        {/each}
      {/each}
    </ul>

    <h2>{t('recipes.steps')}</h2>
    <ol class="steps">
      {#each recipe.steps as s (s.order)}
        <li>
          <div class="thumb" class:shot={!!stepPhotos[s.order]}>
            {#if stepPhotos[s.order]}
              <img src={stepPhotos[s.order]} alt={t('recipes.stepPhotoAlt', { n: s.order, title: recipe.title })} loading="lazy" />
            {/if}
            <span class="n">{s.order}</span>
          </div>
          <div>
            <p>{s.text}</p>
            {#if s.minutes !== null}<span class="t">{t('recipes.minutes', { n: s.minutes })}</span>{/if}
          </div>
        </li>
      {/each}
    </ol>

    <p class="fine">
      {recipe.author.displayName} · {tn('recipes.stepsCount', recipe.steps.length)}{#if substitutes}{' · '}{tn(
          'recipes.subsCount',
          substitutes,
        )}{/if}
    </p>

    {#if !recipe.macros}
      <p class="fine no-macros">{t('recipes.addNoMacros')}</p>
    {/if}

    <div class="dock">
      {#if logged}
        <a class="primary done" href="/nutrition">{t('recipes.added')} {t('recipes.seeToday')}</a>
      {:else}
        <button type="button" class="primary" disabled={!recipe.macros} onclick={openLog}>{t('recipes.addToToday')}</button>
      {/if}
      {#if recipe.isMine}
        <span class="fav" title={tn('recipes.likes', recipe.likeCount)}>
          <Icon name="heart" size={20} />{recipe.likeCount}
        </span>
      {:else}
        <button
          type="button"
          class="fav"
          class:on={recipe.viewerHasLiked}
          aria-pressed={recipe.viewerHasLiked}
          aria-label={tn('recipes.likes', recipe.likeCount)}
          title={t('recipes.like')}
          disabled={likeBusy}
          onclick={toggleLike}><Icon name="heart" size={20} /></button
        >
      {/if}
    </div>
  </main>
{/if}

{#if sheet && recipe}
  <Sheet title={t('recipes.addTitle')} onclose={() => (sheet = false)}>
    <p class="muted lead-sheet">{t('recipes.addLead')}</p>

    <div class="serv-head sheet-serv">
      <div class="stepper big">
        <button
          type="button"
          class="icon ghost"
          aria-label={t('recipes.decrease')}
          disabled={attempt.servings <= 0.5}
          onclick={() => (attempt.servings = clampServings(attempt.servings - 0.5))}><Icon name="down" size={18} /></button
        >
        <span>{tn('recipes.servings', attempt.servings, { n: num(attempt.servings, 1) })}</span>
        <button
          type="button"
          class="icon ghost"
          aria-label={t('recipes.increase')}
          disabled={attempt.servings >= 20}
          onclick={() => (attempt.servings = clampServings(attempt.servings + 0.5))}><Icon name="up" size={18} /></button
        >
      </div>
    </div>

    {#if recipe.macros}
      <div class="sheet-macros">
        <div><b>{Math.round(recipe.macros.calories * attempt.servings)}</b><span>kcal</span></div>
        <div><b>{Math.round(recipe.macros.protein * attempt.servings)}</b><span>g {t('recipes.macro.protein')}</span></div>
        <div><b>{Math.round(recipe.macros.carbs * attempt.servings)}</b><span>g {t('recipes.macro.carbs')}</span></div>
        <div><b>{Math.round(recipe.macros.fat * attempt.servings)}</b><span>g {t('recipes.macro.fat')}</span></div>
      </div>
    {/if}

    {#if logError}<p class="error" role="alert">{logError}</p>{/if}

    <button type="button" class="primary" disabled={logBusy} onclick={addToToday}>
      {logBusy ? t('common.saving') : t('recipes.addConfirm')}
    </button>
  </Sheet>
{/if}

<AppNav />

<style>
  .hero {
    position: relative;
    max-width: 34rem;
    height: 210px;
    margin: 0 auto;
    background: var(--surface-hi);
    border-radius: 0 0 var(--radius) var(--radius);
    overflow: hidden;
  }
  .hero img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .hero-ph {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--faint);
  }
  .detail {
    padding-top: 0;
    padding-bottom: calc(11.5rem + env(safe-area-inset-bottom));
  }
  .backrow {
    margin: 0.4rem 0 0.2rem;
  }
  h1 {
    margin: 0.2rem 0 0.5rem;
  }
  .byline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.7rem;
    color: var(--muted);
    font-size: var(--t-sm);
  }
  .lead {
    margin: 0 0 0.9rem;
    color: var(--muted);
  }
  .draft-note {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    margin: 0 0 0.9rem;
    padding: 0.6rem 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
    color: var(--text);
    font-size: var(--t-sm);
  }
  .draft-note :global(svg) {
    flex: none;
    margin-top: 0.1rem;
    color: var(--accent);
  }
  .rate-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0 0 0.9rem;
    font-size: var(--t-sm);
  }
  .rate-row strong {
    font-weight: 600;
  }
  .rate-row .count {
    color: var(--muted);
  }
  .note {
    margin: -0.4rem 0 0.8rem;
    color: var(--ok);
    font-size: var(--t-sm);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.9rem;
  }
  .macros {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.25rem;
    text-align: center;
    padding: 0.75rem 0.5rem;
    margin-bottom: 0.4rem;
  }
  .macros .n {
    display: block;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.375rem;
    line-height: 1.1;
    white-space: nowrap;
  }
  .macros .l {
    display: block;
    margin-top: 0.15rem;
    color: var(--muted);
    font-size: var(--t-xs);
  }
  .macros .u {
    color: var(--faint);
    font-size: var(--t-xs);
  }
  .fine {
    margin: 0 0 0.5rem;
    color: var(--faint);
    font-size: var(--t-xs);
  }
  .no-macros {
    margin: 1rem 0 0;
    font-size: var(--t-sm);
  }
  .serv-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.4rem;
  }
  .serv-head h2 {
    margin: 0;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 0.1rem;
    padding: 0.15rem;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .stepper button {
    min-height: 32px;
    width: 32px;
    padding: 0;
    border-radius: 999px;
    background: none;
    box-shadow: none;
    color: var(--muted);
  }
  .stepper span {
    min-width: 3.2rem;
    text-align: center;
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .stepper.big button {
    width: 40px;
    min-height: 40px;
  }
  .stepper.big span {
    min-width: 4.5rem;
    font-size: var(--t-base);
  }
  ul.ing {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
  }
  ul.ing li {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.55rem 0;
    border-bottom: 1px solid var(--line);
    font-size: var(--t-base);
  }
  ul.ing li b {
    flex: none;
    min-width: 4.4rem;
    color: var(--text);
    font-weight: 600;
  }
  ul.ing .opt {
    color: var(--faint);
    font-size: var(--t-sm);
  }
  ul.ing li.subst {
    display: grid;
    gap: 0.2rem;
    margin: -0.3rem 0 0.4rem;
    padding: 0.6rem 0.75rem;
    border: 0;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line);
    font-size: var(--t-sm);
  }
  .subst .q {
    color: var(--muted);
  }
  .subst .a::before {
    content: '→ ';
    color: var(--accent);
  }
  ol.steps {
    list-style: none;
    display: grid;
    gap: 0.7rem;
    margin: 0 0 1rem;
    padding: 0;
  }
  ol.steps li {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 0.7rem;
    align-items: start;
  }
  ol.steps .thumb {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    overflow: hidden;
  }
  ol.steps .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  ol.steps .thumb .n {
    position: absolute;
    left: 0;
    top: 0;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-bottom-right-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 11px;
    font-weight: 700;
  }
  ol.steps p {
    margin: 0;
    font-size: var(--t-sm);
  }
  ol.steps .t {
    display: block;
    margin-top: 0.15rem;
    color: var(--faint);
    font-size: var(--t-xs);
  }
  .dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(68px + env(safe-area-inset-bottom));
    z-index: 20;
    display: flex;
    gap: 0.5rem;
    max-width: 34rem;
    margin: 0 auto;
    padding: 0.7rem 1rem;
    background: linear-gradient(to top, var(--bg) 74%, rgb(14 14 16 / 0));
  }
  .dock .primary {
    flex: 1;
    margin-top: 0;
  }
  .dock .done {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 650;
    text-decoration: none;
  }
  .dock .fav {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    width: 56px;
    min-height: 48px;
    padding: 0;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line-strong) inset;
    color: var(--muted);
    font-size: var(--t-sm);
  }
  .dock .fav:not(button) {
    width: auto;
    min-width: 56px;
    padding: 0 0.7rem;
    color: var(--muted);
  }
  .dock .fav.on {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .dock .fav.on :global(path) {
    fill: currentColor;
  }
  .lead-sheet {
    margin: -0.25rem 0 1rem;
    font-size: var(--t-sm);
  }
  .sheet-serv {
    justify-content: center;
    margin-bottom: 1rem;
  }
  .sheet-macros {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.25rem;
    margin-bottom: 1rem;
    padding: 0.75rem 0.5rem;
    border-radius: var(--radius);
    background: var(--surface-hi);
    text-align: center;
  }
  .sheet-macros b {
    display: block;
    font-family: var(--font-display);
    font-size: 1.5rem;
    line-height: 1.1;
  }
  .sheet-macros span {
    color: var(--muted);
    font-size: var(--t-xs);
  }
</style>
