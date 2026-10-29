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
        cachedGet('/nutrition/summary', dailySummarySchema),
        cachedGet('/nutrition/entries?limit=30', nutritionHistoryResponseSchema),
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

  const time = (iso: string) => new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
</script>

<main>
  <h1>Alimentación</h1>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if notice}<p class="ok" role="status">{notice}</p>{/if}

  {#if summary}
    <section class="card">
      <h2>Hoy</h2>
      <p class="big"><strong>{summary.consumed}</strong> kcal</p>
      {#if summary.goal}
        <progress max={summary.goal} value={Math.min(summary.consumed, summary.goal)}></progress>
        <p class="muted">Meta {summary.goal} kcal · {summary.remaining !== null && summary.remaining >= 0 ? `faltan ${summary.remaining}` : `te pasaste ${Math.abs(summary.remaining ?? 0)}`}</p>
      {/if}
      <form class="goal" onsubmit={saveGoal}>
        <label>Meta diaria (kcal)<input inputmode="numeric" bind:value={goalInput} placeholder="Sin meta" /></label>
        <button type="submit">Guardar</button>
      </form>
    </section>
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
      <label class="button">
        {busy ? 'Analizando…' : 'Foto de la comida'}
        <input type="file" accept="image/*" capture="environment" onchange={analyze} disabled={busy} hidden />
      </label>
      <button type="button" onclick={manual}>Agregar a mano</button>
    </div>
  {/if}

  <h2>Últimas comidas</h2>
  {#if entries.length === 0}
    <p class="muted">Todavía no registraste comidas.</p>
  {:else}
    <ul class="list">
      {#each entries as e (e.id)}
        <li class="entry">
          <span>
            <strong>{Math.round(e.totalCalories)} kcal</strong>
            <span class="muted"> · P {Math.round(e.totalProtein)} · C {Math.round(e.totalCarbs)} · G {Math.round(e.totalFat)}</span>
            <br /><span class="muted">{e.foodItems.map((f) => f.name).join(', ') || 'Comida'} · {time(e.loggedAt)}</span>
          </span>
          <button type="button" onclick={() => removeEntry(e)} aria-label="Borrar comida">✕</button>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<AppNav />

<style>
  .big {
    font-size: 1.5rem;
    margin: 0.25rem 0;
  }
  progress {
    width: 100%;
    accent-color: var(--accent);
  }
  .goal {
    display: flex;
    align-items: end;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .goal label {
    flex: 1;
  }
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin: 0.75rem 0;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0;
  }
  .row > * {
    flex: 1;
  }
  .button {
    text-align: center;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: var(--accent);
    color: #052e16;
    font-weight: 600;
  }
  .entry {
    background: var(--surface);
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    align-items: center;
  }
</style>
