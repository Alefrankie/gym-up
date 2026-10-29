<script lang="ts">
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
    if (e instanceof NetworkError) return 'Esta función necesita conexión a internet.';
    if (e instanceof ApiRequestError) {
      if (e.status === 503) return 'El análisis con IA todavía no está activado. Puedes agregar la comida a mano.';
      if (e.status === 422) return 'No se reconoció comida en la foto. Prueba con otra o agrégala a mano.';
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
      error = describe(e, 'No se pudo cargar tu alimentación');
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
      error = describe(e, 'No se pudo analizar la foto');
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
          : [{ name: 'Comida', calories: meal.totalCalories, protein: meal.totalProtein, carbs: meal.totalCarbs, fat: meal.totalFat }],
        ...(image ? { imageBase64: await blobToBase64(image), mimeType: 'image/jpeg' } : {}),
      };
      await api('/nutrition/entries', { body, schema: nutritionEntrySchema, timeoutMs: 45_000 });
      draft = null;
      notice = 'Comida guardada.';
      await invalidateCache(['/nutrition']);
      await load();
    } catch (e) {
      error = describe(e, 'No se pudo guardar la comida');
    } finally {
      busy = false;
    }
  }

  async function removeEntry(e: NutritionEntryDto) {
    if (!confirm('¿Borrar esta comida?')) return;
    try {
      await deleteRequest(`/nutrition/entries/${e.id}`);
      await invalidateCache(['/nutrition']);
      await load();
    } catch (err) {
      error = describe(err, 'No se pudo borrar');
    }
  }

  async function saveGoal(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    const value = goalInput.trim() === '' ? null : Number(goalInput);
    const parsed = calorieGoalSchema.safeParse({ dailyCalorieGoal: value });
    if (!parsed.success) {
      error = 'La meta debe ser un número entre 1 y 10000 kcal.';
      return;
    }
    try {
      await api('/nutrition/goal', { method: 'PUT', body: parsed.data, schema: calorieGoalSchema });
      await invalidateCache(['/nutrition']);
      await load();
    } catch (e) {
      error = describe(e, 'No se pudo guardar la meta');
    }
  }

  const todayMacros = $derived.by(() => {
    const day = new Date().toDateString();
    const t = { p: 0, c: 0, g: 0 };
    for (const e of entries) {
      if (new Date(e.loggedAt).toDateString() !== day) continue;
      t.p += e.totalProtein;
      t.c += e.totalCarbs;
      t.g += e.totalFat;
    }
    return t;
  });
  const time = (iso: string) => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<main>
  <p><a class="back" href="/more"><Icon name="left" size={18} /> Más</a></p>
  <h1>Alimentación</h1>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if notice}<p class="ok" role="status">{notice}</p>{/if}

  {#if summary}
    {@const goal = summary.goal}
    {@const over = goal !== null && summary.consumed > goal}
    <section class="card hero">
      <p class="eyebrow">Hoy</p>
      <p class="total">
        <span class="big-number kcal" class:over>{Math.round(summary.consumed)}</span>
        <span class="muted">{goal ? `/ ${goal} kcal` : 'kcal'}</span>
      </p>
      {#if goal}
        <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax={goal} aria-valuenow={Math.min(summary.consumed, goal)}>
          <div class="fill" class:over style="width: {Math.min(100, (summary.consumed / goal) * 100)}%"></div>
        </div>
        <p class="muted left">{summary.remaining !== null && summary.remaining >= 0 ? `Faltan ${summary.remaining} kcal` : `Te pasaste ${Math.abs(summary.remaining ?? 0)} kcal`}</p>
      {:else}
        <p class="muted left">Sin meta todavía. Define una abajo para ver tu progreso.</p>
      {/if}
      <div class="macros">
        <div><span class="big-number">{Math.round(todayMacros.p)}</span><span class="muted">Proteína g</span></div>
        <div><span class="big-number">{Math.round(todayMacros.c)}</span><span class="muted">Carbos g</span></div>
        <div><span class="big-number">{Math.round(todayMacros.g)}</span><span class="muted">Grasa g</span></div>
      </div>
      <form class="goal" onsubmit={saveGoal}>
        <label>Meta diaria (kcal)<input inputmode="numeric" bind:value={goalInput} placeholder="Sin meta" /></label>
        <button type="submit">Guardar</button>
      </form>
    </section>
  {:else if !error}
    <section class="card hero loading"><p class="muted">Cargando tu día…</p></section>
  {/if}

  {#if draft}
    <section class="card">
      <h2>Revisa la comida</h2>
      {#each draft.foodItems as item}
        <p class="muted">{item.name} · {Math.round(item.calories)} kcal</p>
      {/each}
      <div class="fields">
        <label>Calorías<input type="number" min="0" bind:value={draft.totalCalories} oninput={touched} /></label>
        <label>Proteína (g)<input type="number" min="0" bind:value={draft.totalProtein} oninput={touched} /></label>
        <label>Carbohidratos (g)<input type="number" min="0" bind:value={draft.totalCarbs} oninput={touched} /></label>
        <label>Grasa (g)<input type="number" min="0" bind:value={draft.totalFat} oninput={touched} /></label>
      </div>
      <div class="row">
        <button type="button" onclick={() => (draft = null)}>Cancelar</button>
        <button type="button" class="primary" disabled={busy} onclick={save}>{busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </section>
  {:else}
    <div class="row">
      <label class="cta" class:disabled={busy}>
        <Icon name="camera" size={18} />
        {busy ? 'Analizando…' : 'Foto de la comida'}
        <input type="file" accept="image/*" capture="environment" onchange={analyze} disabled={busy} hidden />
      </label>
      <button type="button" onclick={manual}><Icon name="plus" size={16} /> Agregar a mano</button>
    </div>
  {/if}

  <h2>Últimas comidas</h2>
  {#if entries.length === 0}
    <p class="muted">Todavía no registraste comidas. Saca una foto o agrégala a mano.</p>
  {:else}
    <ul class="list">
      {#each entries as e (e.id)}
        <li>
          <div class="row-body">
            <Icon name="utensils" size={18} />
            <span class="grow">
              <strong>{Math.round(e.totalCalories)} kcal</strong>
              <span class="muted">P {Math.round(e.totalProtein)} · C {Math.round(e.totalCarbs)} · G {Math.round(e.totalFat)}</span>
              <span class="muted">{e.foodItems.map((f) => f.name).join(', ') || 'Comida'} · {time(e.loggedAt)}</span>
            </span>
          </div>
          <button type="button" class="icon ghost" onclick={() => removeEntry(e)} aria-label="Borrar comida"><Icon name="trash" size={18} /></button>
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
