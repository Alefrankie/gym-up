<script lang="ts">
  import { t } from '#lib/i18n';
  import { goto } from '$app/navigation';
  import { onDestroy, onMount } from 'svelte';
  import {
    createRecipeRequestSchema,
    recipeDetailSchema,
    recipePhotoSchema,
    type CreateRecipeRequest,
    type RecipeTag,
  } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { invalidateCache } from '#lib/offline/cache';
  import { blobToBase64, compressImage } from '#lib/image';
  import { photoMime, RECIPE_TAGS, tagKey } from '#lib/recipes';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';

  interface SubRow {
    key: string;
    name: string;
  }
  interface IngRow {
    key: string;
    quantity: string;
    unit: string;
    name: string;
    optional: boolean;
    substitutes: SubRow[];
  }
  interface StepRow {
    key: string;
    text: string;
    minutes: string;
  }

  // One id for the whole screen: a retry after a lost response returns the recipe already created
  // instead of writing a second draft (the API is idempotent per id and author).
  const id = crypto.randomUUID();

  let title = $state('');
  let description = $state('');
  let prep = $state('');
  let cook = $state('');
  let servingsInput = $state('2');

  let cover = $state<Blob | null>(null);
  let preview = $state<string | null>(null);
  let coverBusy = $state(false);
  let fileInput = $state<HTMLInputElement>();

  let ingredients = $state<IngRow[]>([newIngredient()]);
  let steps = $state<StepRow[]>([{ key: crypto.randomUUID(), text: '', minutes: '' }]);
  let tags = $state<RecipeTag[]>([]);
  let macrosOn = $state(false);
  let macros = $state({ calories: '', protein: '', carbs: '', fat: '' });

  let busy = $state(false);
  let error = $state<string | null>(null);

  function newIngredient(): IngRow {
    return { key: crypto.randomUUID(), quantity: '', unit: '', name: '', optional: false, substitutes: [] };
  }

  onMount(async () => {
    await session.require();
  });

  onDestroy(() => {
    if (preview) URL.revokeObjectURL(preview);
  });

  async function pickCover(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    coverBusy = true;
    error = null;
    try {
      // Compressed here, not on save: the preview is then the exact bytes that will be uploaded.
      cover = await compressImage(file, 1600, 0.8);
      if (preview) URL.revokeObjectURL(preview);
      preview = URL.createObjectURL(cover);
    } finally {
      coverBusy = false;
    }
  }

  function addSubstitute(ing: IngRow) {
    if (ing.substitutes.length >= 6) return;
    ing.substitutes.push({ key: crypto.randomUUID(), name: '' });
  }

  function removeSubstitute(ing: IngRow, key: string) {
    ing.substitutes = ing.substitutes.filter((s) => s.key !== key);
  }

  function removeIngredient(key: string) {
    ingredients = ingredients.filter((i) => i.key !== key);
    if (ingredients.length === 0) ingredients = [newIngredient()];
  }

  function removeStep(key: string) {
    steps = steps.filter((s) => s.key !== key);
    if (steps.length === 0) steps = [{ key: crypto.randomUUID(), text: '', minutes: '' }];
  }

  function toggleTag(tag: RecipeTag) {
    tags = tags.includes(tag) ? tags.filter((t0) => t0 !== tag) : tags.length < 6 ? [...tags, tag] : tags;
  }

  const intOrNull = (value: string): number | null => {
    const n = Number(value.trim().replace(',', '.'));
    return value.trim() === '' || !Number.isFinite(n) ? null : Math.round(n);
  };
  const decOrNull = (value: string): number | null => {
    const n = Number(value.trim().replace(',', '.'));
    return value.trim() === '' || !Number.isFinite(n) ? null : n;
  };

  /** What the editor shows, in the shape the API takes. Empty rows are dropped, not sent as blanks. */
  function draft(): CreateRecipeRequest {
    return {
      id,
      title: title.trim(),
      description: description.trim() || null,
      prepMinutes: intOrNull(prep),
      cookMinutes: intOrNull(cook),
      servings: Math.min(20, Math.max(1, intOrNull(servingsInput) ?? 2)),
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          id: i.key,
          quantity: decOrNull(i.quantity),
          unit: i.unit.trim() || null,
          name: i.name.trim(),
          optional: i.optional,
          substitutes: i.substitutes
            .filter((s) => s.name.trim())
            .map((s) => ({ id: s.key, name: s.name.trim(), quantity: null, unit: null, note: null })),
        })),
      steps: steps
        .filter((s) => s.text.trim())
        .map((s, index) => ({ order: index + 1, text: s.text.trim(), minutes: intOrNull(s.minutes) })),
      tags,
      macros: macrosOn
        ? {
            calories: decOrNull(macros.calories)!,
            protein: decOrNull(macros.protein)!,
            carbs: decOrNull(macros.carbs)!,
            fat: decOrNull(macros.fat)!,
          }
        : null,
    };
  }

  function describe(e: unknown): string {
    if (e instanceof NetworkError) return t('recipes.create.offline');
    if (e instanceof ApiRequestError) return e.message;
    return t('recipes.create.error');
  }

  async function save() {
    if (busy) return;
    error = null;

    if (macrosOn) {
      const numbers = [macros.calories, macros.protein, macros.carbs, macros.fat].map(decOrNull);
      if (numbers.some((n) => n === null || n < 0)) {
        error = t('recipes.create.macrosIncomplete');
        return;
      }
    }

    const body = draft();
    if (!body.title) {
      error = t('recipes.create.titleRequired');
      return;
    }
    if (body.ingredients.length === 0) {
      error = t('recipes.create.ingredientsRequired');
      return;
    }
    if (body.steps.length === 0) {
      error = t('recipes.create.stepsRequired');
      return;
    }

    const parsed = createRecipeRequestSchema.safeParse(body);
    if (!parsed.success) {
      error = t('recipes.create.error');
      return;
    }

    if (!navigator.onLine) {
      error = t('recipes.create.offline');
      return;
    }

    busy = true;
    try {
      await api('/recipes', { method: 'POST', body: parsed.data, schema: recipeDetailSchema, timeoutMs: 30_000 });

      if (cover) {
        // The text is already saved. If the cover cannot be uploaded the recipe stays a draft, which the
        // detail screen explains; losing a written recipe to a failed photo would be the worse outcome.
        try {
          await api(`/recipes/${id}/photos`, {
            method: 'POST',
            body: { imageBase64: await blobToBase64(cover), mimeType: photoMime(cover), stepOrder: null },
            schema: recipePhotoSchema,
            timeoutMs: 45_000,
          });
        } catch {
          /* stays a draft */
        }
      }

      await invalidateCache(['/recipes', '/nutrition']);
      await goto(`/nutrition/recipes/${id}`, { replaceState: true });
    } catch (e) {
      error = describe(e);
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <p class="backrow">
    <a class="back" href="/nutrition?tab=recetas"><Icon name="left" size={18} /> {t('recipes.tab.recipes')}</a>
  </p>

  <h1>{t('recipes.create.title')}</h1>

  <input
    bind:this={fileInput}
    class="file"
    type="file"
    accept="image/*"
    aria-label={t('recipes.create.cover')}
    onchange={pickCover}
  />
  <button
    type="button"
    class="shot"
    class:has={!!preview}
    disabled={coverBusy}
    onclick={() => fileInput?.click()}
  >
    {#if preview}
      <img src={preview} alt={t('recipes.create.cover')} />
      <span class="change">{coverBusy ? t('common.saving') : t('recipes.create.coverChange')}</span>
    {:else}
      <span class="cam"><Icon name="camera" size={26} /></span>
      <span class="shot-label">{coverBusy ? t('common.saving') : t('recipes.create.cover')}</span>
      <span class="hint">{t('recipes.create.coverHint')}</span>
    {/if}
  </button>
  <p class="fine">{t('recipes.create.coverRequired')}</p>

  <label class="field">
    <span>{t('recipes.create.name')}</span>
    <input bind:value={title} maxlength="120" placeholder="Pollo al limón con arroz" />
  </label>

  <label class="field">
    <span>{t('recipes.create.description')}</span>
    <textarea bind:value={description} rows="2" maxlength="500"></textarea>
  </label>

  <div class="row3">
    <label class="field">
      <span>{t('recipes.create.prep')}</span>
      <input bind:value={prep} inputmode="numeric" placeholder="10" />
    </label>
    <label class="field">
      <span>{t('recipes.create.cook')}</span>
      <input bind:value={cook} inputmode="numeric" placeholder="20" />
    </label>
    <label class="field">
      <span>{t('recipes.create.servings')}</span>
      <input bind:value={servingsInput} inputmode="numeric" placeholder="2" />
    </label>
  </div>

  <h2 class="sect">{t('recipes.ingredients')}</h2>
  {#each ingredients as ing (ing.key)}
    <div class="ing">
      <div class="ing-top">
        <input bind:value={ing.name} maxlength="160" placeholder={t('recipes.create.ingredient')} aria-label={t('recipes.create.ingredient')} />
        <button type="button" class="icon ghost" aria-label={t('recipes.create.remove')} onclick={() => removeIngredient(ing.key)}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div class="ing-qty">
        <input
          bind:value={ing.quantity}
          inputmode="decimal"
          placeholder={t('recipes.create.quantity')}
          aria-label={t('recipes.create.quantity')}
        />
        <input bind:value={ing.unit} maxlength="24" placeholder={t('recipes.create.unit')} aria-label={t('recipes.create.unit')} />
        <label class="opt"><input type="checkbox" bind:checked={ing.optional} /> {t('recipes.create.optional')}</label>
      </div>
      {#each ing.substitutes as sub (sub.key)}
        <div class="sub-row">
          <span class="sub-label">{t('recipes.create.substituteOf', { name: ing.name.trim() || '…' })}</span>
          <input bind:value={sub.name} maxlength="120" placeholder={t('recipes.create.substituteName')} />
          <button type="button" class="icon ghost" aria-label={t('recipes.create.remove')} onclick={() => removeSubstitute(ing, sub.key)}>
            <Icon name="x" size={16} />
          </button>
        </div>
      {/each}
      {#if ing.substitutes.length < 6}
        <button type="button" class="add-alt" onclick={() => addSubstitute(ing)}>
          + {t('recipes.create.addSubstitute')}
        </button>
      {/if}
    </div>
  {/each}
  <button type="button" class="add" onclick={() => ingredients.push(newIngredient())}>
    <Icon name="plus" size={16} /> {t('recipes.create.addIngredient')}
  </button>

  <h2 class="sect">{t('recipes.steps')}</h2>
  {#each steps as step, index (step.key)}
    <div class="step">
      <span class="n">{index + 1}</span>
      <div class="step-body">
        <textarea bind:value={step.text} rows="2" maxlength="1200" placeholder={t('recipes.create.stepPlaceholder')}></textarea>
        <div class="step-foot">
          <input
            class="mins"
            bind:value={step.minutes}
            inputmode="numeric"
            maxlength="3"
            placeholder={t('recipes.create.stepMinutes')}
            aria-label={t('recipes.create.stepMinutes')}
          />
          <button type="button" class="icon ghost" aria-label={t('recipes.create.remove')} onclick={() => removeStep(step.key)}>
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>
    </div>
  {/each}
  <button type="button" class="add" onclick={() => steps.push({ key: crypto.randomUUID(), text: '', minutes: '' })}>
    <Icon name="plus" size={16} /> {t('recipes.create.addStep')}
  </button>

  <h2 class="sect">{t('recipes.create.tags')}</h2>
  <div class="chips">
    {#each RECIPE_TAGS as tag (tag)}
      {@const on = tags.includes(tag)}
      <button
        type="button"
        class="chip"
        class:on
        aria-pressed={on}
        disabled={!on && tags.length >= 6}
        onclick={() => toggleTag(tag)}>{t(tagKey(tag))}</button
      >
    {/each}
  </div>

  <h2 class="sect">{t('recipes.create.macros')}</h2>
  <label class="toggle">
    <input type="checkbox" bind:checked={macrosOn} />
    <span>{t('recipes.create.macrosHint')}</span>
  </label>
  {#if macrosOn}
    <div class="row4">
      <label class="field">
        <span>kcal</span>
        <input bind:value={macros.calories} inputmode="decimal" placeholder="480" />
      </label>
      <label class="field">
        <span>{t('recipes.macro.protein')}</span>
        <input bind:value={macros.protein} inputmode="decimal" placeholder="38" />
      </label>
      <label class="field">
        <span>{t('recipes.macro.carbs')}</span>
        <input bind:value={macros.carbs} inputmode="decimal" placeholder="45" />
      </label>
      <label class="field">
        <span>{t('recipes.macro.fat')}</span>
        <input bind:value={macros.fat} inputmode="decimal" placeholder="12" />
      </label>
    </div>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <button type="button" class="primary publish" disabled={busy} onclick={save}>
    {busy
      ? t('recipes.create.publishing')
      : cover
        ? t('recipes.create.publish')
        : t('recipes.create.saveDraft')}
  </button>
</main>

<AppNav />

<style>
  .backrow {
    margin: 0.4rem 0 0.2rem;
  }
  h1 {
    margin: 0.2rem 0 0.9rem;
  }
  .file {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    opacity: 0;
    pointer-events: none;
  }
  .shot {
    position: relative;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.35rem;
    width: 100%;
    height: 168px;
    padding: 0;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: none;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
    text-align: center;
    overflow: hidden;
  }
  .shot.has {
    border-style: solid;
    border-color: var(--line);
    padding: 0;
  }
  .shot img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .shot .change {
    position: absolute;
    left: 50%;
    bottom: 0.6rem;
    transform: translateX(-50%);
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    background: rgb(14 14 16 / 0.82);
    color: var(--text);
    font-size: var(--t-xs);
    font-weight: 600;
  }
  .shot .cam {
    color: var(--accent);
    line-height: 1;
  }
  .shot .hint {
    color: var(--faint);
    font-size: var(--t-xs);
    font-weight: 400;
  }
  .fine {
    margin: 0.4rem 0 1.1rem;
    color: var(--faint);
    font-size: var(--t-xs);
  }
  .field {
    display: grid;
    gap: 0.25rem;
    margin-bottom: 0.7rem;
  }
  .field > span {
    color: var(--muted);
    font-size: var(--t-xs);
    font-weight: 500;
  }
  .row3,
  .row4 {
    display: grid;
    gap: 0.5rem;
  }
  .row3 {
    grid-template-columns: repeat(3, 1fr);
  }
  .row4 {
    grid-template-columns: repeat(4, 1fr);
  }
  .sect {
    margin: 1.2rem 0 0.5rem;
  }
  .ing {
    display: grid;
    gap: 0.35rem;
    margin-bottom: 0.6rem;
    padding: 0.6rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line);
  }
  .ing-top {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .ing-top input {
    flex: 1;
    min-width: 0;
  }
  .ing-qty {
    display: grid;
    grid-template-columns: 5.5rem 4.5rem 1fr;
    align-items: center;
    gap: 0.35rem;
  }
  .opt {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--muted);
    font-size: var(--t-xs);
    font-weight: 400;
    white-space: nowrap;
  }
  .opt input {
    width: 18px;
    min-height: 18px;
    accent-color: var(--accent);
  }
  .sub-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .sub-row input {
    flex: 1;
    min-width: 0;
  }
  .sub-label {
    flex: none;
    max-width: 42%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--faint);
    font-size: var(--t-xs);
  }
  .add-alt {
    justify-self: start;
    min-height: 32px;
    padding: 0 0.2rem;
    background: none;
    box-shadow: none;
    color: var(--accent-hi);
    font-size: var(--t-xs);
    font-weight: 600;
  }
  .add {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    width: auto;
    min-height: 40px;
    margin-bottom: 0.4rem;
    padding: 0 0.85rem;
    background: none;
    box-shadow: 0 0 0 1px var(--line-strong) inset;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 550;
  }
  .step {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 0.5rem;
    margin-bottom: 0.55rem;
  }
  .step .n {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    margin-top: 0.55rem;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-hi);
    font-size: 12px;
    font-weight: 700;
  }
  .step-body {
    display: grid;
    gap: 0.35rem;
  }
  .step-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .mins {
    width: 4.5rem;
    min-height: 36px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .toggle {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 400;
  }
  .toggle input {
    width: 20px;
    min-height: 20px;
    margin-top: 0.15rem;
    accent-color: var(--accent);
  }
  .publish {
    margin-top: 1.1rem;
    margin-bottom: calc(5.5rem + env(safe-area-inset-bottom));
  }
</style>
