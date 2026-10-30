<script lang="ts">
  import { t, dateLocale } from '#lib/i18n';
  import { onMount } from 'svelte';
  import {
    analyzeMealResponseSchema,
    calorieGoalSchema,
    dailySummarySchema,
    nutritionEntrySchema,
    nutritionHistoryResponseSchema,
    type DailySummaryDto,
    type MealAnalysisDto,
    type NutritionEntryDto,
  } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { deleteRequest } from '#lib/api/binary';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { blobToBase64, compressImage } from '#lib/image';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';

  interface Draft extends MealAnalysisDto {
    id: string;
    userEdited: boolean;
    image?: Blob;
  }

  let summary = $state<DailySummaryDto | null>(null);
  let entries = $state<NutritionEntryDto[]>([]);
  let draft = $state<Draft | null>(null);
  let goalInput = $state('');
  let error = $state<string | null>(null);
  let notice = $state<string | null>(null);
  let busy = $state(false);

  function describe(e: unknown, fallback: string): string {
    if (e instanceof NetworkError) return t('nutrition.needsConnection');
    if (e instanceof ApiRequestError) {
      if (e.status === 503) return t('nutrition.aiDisabled');
      if (e.status === 422) return t('nutrition.noFood');
      return e.message;
    }
    return fallback;
  }

  async function load() {
    try {
      const [s, h] = await Promise.all([
        cachedGet('/nutrition/summary', dailySummarySchema, { onCached: (c) => ((summary = c.data), (goalInput = c.data.goal ? String(c.data.goal) : '')) }),
        cachedGet('/nutrition/entries?limit=30', nutritionHistoryResponseSchema, { onCached: (c) => (entries = c.data) }),
      ]);
      summary = s.data;
      entries = h.data;
      goalInput = s.data.goal ? String(s.data.goal) : '';
    } catch (e) {
      error = describe(e, t('nutrition.loadError'));
    }
  }

  onMount(async () => {
    if (await session.require()) await load();
  });

  async function analyze(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    error = null;
    notice = null;
    try {
      const image = await compressImage(file, 1280, 0.75);
      const result = await api('/nutrition/analyze', {
        body: { imageBase64: await blobToBase64(image), mimeType: 'image/jpeg' },
        schema: analyzeMealResponseSchema,
        timeoutMs: 45_000,
      });
      draft = { ...result, id: crypto.randomUUID(), userEdited: false, image };
    } catch (e) {
      error = describe(e, t('nutrition.analyzeError'));
    } finally {
      busy = false;
    }
  }

  function manual() {
    error = null;
    draft = { id: crypto.randomUUID(), totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, foodItems: [], userEdited: true };
  }

  const touched = () => {
    if (draft) draft.userEdited = true;
  };

  async function save() {
    if (!draft) return;
    busy = true;
    error = null;
    try {
      const { image, ...meal } = draft;
      const body = {
        ...meal,
        foodItems: meal.foodItems.length
          ? meal.foodItems
          : [{ name: t('nutrition.meal'), calories: meal.totalCalories, protein: meal.totalProtein, carbs: meal.totalCarbs, fat: meal.totalFat }],
        ...(image ? { imageBase64: await blobToBase64(image), mimeType: 'image/jpeg' } : {}),
      };
      await api('/nutrition/entries', { body, schema: nutritionEntrySchema, timeoutMs: 45_000 });
      draft = null;
      notice = t('nutrition.saved');
      await invalidateCache(['/nutrition']);
      await load();
    } catch (e) {
      error = describe(e, t('nutrition.saveError'));
    } finally {
      busy = false;
    }
  }

  async function removeEntry(e: NutritionEntryDto) {
    if (!confirm(t('nutrition.confirmDelete'))) return;
    try {
      await deleteRequest(`/nutrition/entries/${e.id}`);
      await invalidateCache(['/nutrition']);
      await load();
    } catch (err) {
      error = describe(err, t('nutrition.deleteError'));
    }
  }

  async function saveGoal(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    const value = goalInput.trim() === '' ? null : Number(goalInput);
    const parsed = calorieGoalSchema.safeParse({ dailyCalorieGoal: value });
    if (!parsed.success) {
      error = t('nutrition.goalInvalid');
      return;
    }
    try {
      await api('/nutrition/goal', { method: 'PUT', body: parsed.data, schema: calorieGoalSchema });
      await invalidateCache(['/nutrition']);
      await load();
    } catch (e) {
      error = describe(e, t('nutrition.goalSaveError'));
    }
  }

  const todayMacros = $derived.by(() => {
    const day = new Date().toDateString();
    const m = { p: 0, c: 0, g: 0 };
    for (const e of entries) {
      if (new Date(e.loggedAt).toDateString() !== day) continue;
      m.p += e.totalProtein;
      m.c += e.totalCarbs;
      m.g += e.totalFat;
    }
    return m;
  });
  const time = (iso: string) => new Date(iso).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<main>
  <p><a class="back" href="/more"><Icon name="left" size={18} /> {t('nav.more')}</a></p>
  <h1>{t('nutrition.title')}</h1>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if notice}<p class="ok" role="status">{notice}</p>{/if}

  {#if summary}
    {@const goal = summary.goal}
    {@const over = goal !== null && summary.consumed > goal}
    <section class="card hero">
      <p class="eyebrow">{t('common.today')}</p>
      <p class="total">
        <span class="big-number kcal" class:over>{Math.round(summary.consumed)}</span>
        <span class="muted">{goal ? `/ ${goal} kcal` : 'kcal'}</span>
      </p>
      {#if goal}
        <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax={goal} aria-valuenow={Math.min(summary.consumed, goal)}>
          <div class="fill" class:over style="width: {Math.min(100, (summary.consumed / goal) * 100)}%"></div>
        </div>
        <p class="muted left">{summary.remaining !== null && summary.remaining >= 0 ? t('nutrition.remaining', { n: summary.remaining }) : t('nutrition.over', { n: Math.abs(summary.remaining ?? 0) })}</p>
      {:else}
        <p class="muted left">{t('nutrition.noGoal')}</p>
      {/if}
      <div class="macros">
        <div><span class="big-number">{Math.round(todayMacros.p)}</span><span class="muted">{t('nutrition.proteinG')}</span></div>
        <div><span class="big-number">{Math.round(todayMacros.c)}</span><span class="muted">{t('nutrition.carbsG')}</span></div>
        <div><span class="big-number">{Math.round(todayMacros.g)}</span><span class="muted">{t('nutrition.fatG')}</span></div>
      </div>
      <form class="goal" onsubmit={saveGoal}>
        <label>{t('nutrition.dailyGoal')}<input inputmode="numeric" bind:value={goalInput} placeholder={t('nutrition.noGoalPlaceholder')} /></label>
        <button type="submit">{t('common.save')}</button>
      </form>
    </section>
  {:else if !error}
    <section class="card hero loading"><p class="muted">{t('nutrition.loadingDay')}</p></section>
  {/if}

  {#if draft}
    <section class="card">
      <h2>{t('nutrition.review')}</h2>
      {#each draft.foodItems as item}
        <p class="muted">{item.name} · {Math.round(item.calories)} kcal</p>
      {/each}
      <div class="fields">
        <label>{t('nutrition.calories')}<input type="number" min="0" bind:value={draft.totalCalories} oninput={touched} /></label>
        <label>{t('nutrition.protein')}<input type="number" min="0" bind:value={draft.totalProtein} oninput={touched} /></label>
        <label>{t('nutrition.carbs')}<input type="number" min="0" bind:value={draft.totalCarbs} oninput={touched} /></label>
        <label>{t('nutrition.fat')}<input type="number" min="0" bind:value={draft.totalFat} oninput={touched} /></label>
      </div>
      <div class="row">
        <button type="button" onclick={() => (draft = null)}>{t('common.cancel')}</button>
        <button type="button" class="primary" disabled={busy} onclick={save}>{busy ? t('common.saving') : t('common.save')}</button>
      </div>
    </section>
  {:else}
    <div class="row">
      <label class="cta" class:disabled={busy}>
        <Icon name="camera" size={18} />
        {busy ? t('nutrition.analyzing') : t('nutrition.photo')}
        <input type="file" accept="image/*" capture="environment" onchange={analyze} disabled={busy} hidden />
      </label>
      <button type="button" onclick={manual}><Icon name="plus" size={16} /> {t('nutrition.manual')}</button>
    </div>
  {/if}

  <h2>{t('nutrition.recent')}</h2>
  {#if entries.length === 0}
    <p class="muted">{t('nutrition.empty')}</p>
  {:else}
    <ul class="list">
      {#each entries as e (e.id)}
        <li>
          <div class="row-body">
            <Icon name="utensils" size={18} />
            <span class="grow">
              <strong>{Math.round(e.totalCalories)} kcal</strong>
              <span class="muted">{t('nutrition.macrosShort', { p: Math.round(e.totalProtein), c: Math.round(e.totalCarbs), f: Math.round(e.totalFat) })}</span>
              <span class="muted">{e.foodItems.map((f) => f.name).join(', ') || t('nutrition.meal')} · {time(e.loggedAt)}</span>
            </span>
          </div>
          <button type="button" class="icon ghost" onclick={() => removeEntry(e)} aria-label={t('nutrition.deleteLabel')}><Icon name="trash" size={18} /></button>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<AppNav />

<style>
  .eyebrow {
    margin: 0 0 0.35rem;
    color: var(--text);
    font-size: var(--t-base);
    font-weight: 600;
  }
  .total {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    margin: 0 0 0.6rem;
  }
  .total .muted {
    font-size: var(--t-sm);
  }
  .kcal {
    color: var(--text);
  }
  .kcal.over {
    color: var(--ember);
  }
  .track {
    height: 6px;
    border-radius: 999px;
    background: var(--raised);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
    transition: width 300ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .fill.over {
    background: var(--ember);
  }
  .left {
    margin: 0.5rem 0 0;
    font-size: var(--t-sm);
  }
  .macros {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin-top: 0.9rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--line);
  }
  .macros div {
    display: grid;
    gap: 0.1rem;
  }
  .macros .big-number {
    font-family: var(--font-body);
    font-size: var(--t-lg);
    font-weight: 600;
    line-height: 1.2;
  }
  .macros .muted {
    font-size: var(--t-xs);
  }
  .goal {
    display: flex;
    align-items: end;
    gap: 0.5rem;
    margin-top: 0.9rem;
  }
  .goal label {
    flex: 1;
  }
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
    margin: 0.75rem 0;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }
  .row > * {
    flex: 1;
  }
  .row .primary {
    margin-top: 0;
  }
  button :global(svg) {
    vertical-align: -3px;
  }
  .cta {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: var(--control);
    padding: 0.5rem 0.9rem;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: var(--t-base);
    font-weight: 600;
    cursor: pointer;
  }
  .cta.disabled {
    opacity: 0.45;
    cursor: default;
  }
  .list li {
    align-items: center;
  }
  .list .grow span:first-child {
    display: block;
  }
  .row-body :global(svg) {
    flex: none;
    color: var(--muted);
  }
</style>
