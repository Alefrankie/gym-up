<script lang="ts">
  import { onMount } from 'svelte';
  import type { SupplementListResponse } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import { loadSupplements, localDay, persistMark, withMark } from '#lib/supplements';
  import DayStrip from '#lib/components/DayStrip.svelte';
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
  <p class="muted lead">Marca lo que tomaste hoy. Las barras muestran los últimos 30 días.</p>
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
                {s.days.filter((d) => d.startsWith(list!.day.slice(0, 7))).length} días este mes{#if s.streak > 1} · <span class="streak">{s.streak} seguidos</span>{/if}
              </span>
            </span>
            <button type="button" class="ghost del" aria-label={`Quitar ${s.name}`} onclick={() => remove(s.id, s.name)}><Icon name="trash" size={18} /></button>
          </div>
          <DayStrip days={s.days} end={list.day} label={s.name} />
        </li>
      {/each}
    </ul>

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
</style>
