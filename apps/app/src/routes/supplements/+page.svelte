<script lang="ts">
  import { onMount } from 'svelte';
  import type { SupplementListResponse } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import { longDate, relativeDay } from '#lib/dates';
  import { loadSupplements, localDay, persistMark, withMark } from '#lib/supplements';
  import DayStrip from '#lib/components/DayStrip.svelte';
  import SupplementCalendar from '#lib/components/SupplementCalendar.svelte';
  import Icon from '#lib/components/Icon.svelte';

  const today = localDay();
  let list = $state<SupplementListResponse | null>(null);
  let name = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function load() {
    try {
      list = (await loadSupplements(today, (r) => (list = r))).data;
    } catch (e) {
      error = e instanceof NetworkError ? 'Sin conexión y sin suplementos guardados todavía.' : 'No se pudieron cargar tus suplementos';
    }
  }

  onMount(async () => {
    if (await session.require()) await load();
  });

  /** Day by day, newest first: what was taken. Only days with something taken are listed. */
  const history = $derived.by(() => {
    if (!list) return [];
    const byDay = new Map<string, string[]>();
    for (const s of list.items) for (const d of s.days) byDay.set(d, [...(byDay.get(d) ?? []), s.name]);
    return [...byDay].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, names]) => ({ day, names }));
  });

  async function toggle(id: string, taken: boolean) {
    if (!list) return;
    // A plain copy: IndexedDB cannot store Svelte's reactive proxies.
    const next = withMark($state.snapshot(list), id, taken);
    list = next;
    void persistMark(next, id, taken);
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    busy = true;
    error = null;
    try {
      await api('/supplements', { body: { id: crypto.randomUUID(), name: name.trim() } });
      name = '';
      await invalidateCache(['/supplements']);
      await load();
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'Necesitas conexión para añadir un suplemento';
    }
    busy = false;
  }

  async function remove(id: string, label: string) {
    if (!confirm(`¿Quitar "${label}" de tu lista? Su historial se conserva.`)) return;
    try {
      await api(`/supplements/${id}`, { method: 'DELETE' });
      await invalidateCache(['/supplements']);
      await load();
    } catch {
      error = 'Necesitas conexión para quitar un suplemento';
    }
  }
</script>

<main>
  <p><a class="back" href="/dashboard"><Icon name="left" size={18} /> Inicio</a></p>
  <h1>Suplementos</h1>
  <p class="muted lead">Hoy es {longDate()}. Marca lo que tomaste; las barras son los últimos 30 días.</p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if list}
    <ul class="items">
      {#each list.items as s (s.id)}
        <li>
          <div class="row">
            <button type="button" class="tick" class:on={s.taken} aria-pressed={s.taken} aria-label={`${s.name}: ${s.taken ? 'tomado hoy' : 'marcar como tomado'}`} onclick={() => toggle(s.id, !s.taken)}>
              {#if s.taken}<Icon name="check" size={18} />{/if}
            </button>
            <span class="grow">
              <strong>{s.name}</strong>
              <span class="muted">
                {s.days.filter((d) => d.startsWith(list!.day.slice(0, 7))).length === 1 ? '1 día' : `${s.days.filter((d) => d.startsWith(list!.day.slice(0, 7))).length} días`} este mes{#if s.streak > 1} · <span class="streak">{s.streak} seguidos</span>{/if}
              </span>
            </span>
            <button type="button" class="ghost del" aria-label={`Quitar ${s.name}`} onclick={() => remove(s.id, s.name)}><Icon name="trash" size={18} /></button>
          </div>
          <DayStrip days={s.days} end={list.day} label={s.name} />
        </li>
      {/each}
    </ul>

    <h2>Calendario</h2>
    <SupplementCalendar items={list.items} today={list.day} />

    {#if history.length}
      <h2>Día a día</h2>
      <ul class="log">
        {#each history as h (h.day)}
          <li>
            <span class="when">{relativeDay(h.day, list.day)}</span>
            <span class="what">
              {#each h.names as n (n)}<span class="chip on">{n}</span>{/each}
            </span>
          </li>
        {/each}
      </ul>
    {/if}

    <form class="add" onsubmit={add}>
      <input maxlength="40" placeholder="Añadir (ej. Omega 3, magnesio…)" aria-label="Nuevo suplemento" bind:value={name} />
      <button type="submit" disabled={busy || !name.trim()}><Icon name="plus" size={18} /> Añadir</button>
    </form>
  {:else if !error}
    <p class="muted loading">Cargando…</p>
  {/if}
</main>

<style>
  .lead {
    margin-top: -0.5rem;
    font-size: var(--t-sm);
  }
  .items {
    list-style: none;
    margin: 1rem 0;
    padding: 0;
    display: grid;
    gap: 1.25rem;
  }
  li {
    display: grid;
    gap: 0.6rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .tick {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    min-height: 44px;
    padding: 0;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 0 0 1.5px var(--line-strong) inset;
    color: var(--accent-ink);
  }
  .tick.on {
    background: var(--accent);
    box-shadow: none;
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.1rem;
  }
  .grow .muted {
    font-size: var(--t-sm);
  }
  .streak {
    color: var(--ember);
  }
  .del {
    width: 40px;
    padding: 0;
    color: var(--faint);
  }
  .add {
    display: flex;
    gap: 0.5rem;
  }
  .add input {
    flex: 1;
  }
  .add button {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .log {
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
    display: grid;
  }
  .log li {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    align-items: center;
    gap: 0.5rem;
    min-height: 48px;
    border-bottom: 1px solid var(--line);
  }
  .when {
    color: var(--muted);
    font-size: var(--t-sm);
    text-transform: capitalize;
  }
  .what {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
</style>
