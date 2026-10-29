<script lang="ts">
  import { onMount } from 'svelte';
  import type { SupplementListResponse } from '@gym-up/contracts';
  import { NetworkError } from '#lib/api/errors';
  import { loadSupplements, localDay, persistMark, withMark } from '#lib/supplements';
  import Icon from './Icon.svelte';

  /** Today's supplement checklist: one tap to say "taken", so there is no more wondering about the creatine. */
  let list = $state<SupplementListResponse | null>(null);
  let offline = $state(false);

  onMount(async () => {
    try {
      list = (await loadSupplements(localDay(), (r) => (list = r))).data;
    } catch (e) {
      offline = e instanceof NetworkError;
    }
  });

  const done = $derived(list ? list.items.filter((i) => i.taken).length : 0);

  async function toggle(id: string, taken: boolean) {
    if (!list) return;
    navigator.vibrate?.(10);
    // Paint first: the tick must feel instant, saving happens behind it.
    // A plain copy: IndexedDB cannot store Svelte's reactive proxies.
    const next = withMark($state.snapshot(list), id, taken);
    list = next;
    void persistMark(next, id, taken);
  }
</script>

{#if list && list.items.length}
  <section class="supps" aria-label="Suplementos de hoy">
    <header>
      <h2>Suplementos</h2>
      <span class="muted count">{done}/{list.items.length} hoy</span>
      <a class="manage" href="/supplements" aria-label="Gestionar suplementos"><Icon name="sliders" size={18} /></a>
    </header>
    <div class="chips">
      {#each list.items as s (s.id)}
        <button type="button" class="pill" class:on={s.taken} aria-pressed={s.taken} onclick={() => toggle(s.id, !s.taken)}>
          <span class="box" aria-hidden="true">{#if s.taken}<Icon name="check" size={14} />{/if}</span>
          <span class="name">{s.name}</span>
          {#if s.streak > 1}<span class="streak"><Icon name="flame" size={12} />{s.streak}</span>{/if}
        </button>
      {/each}
    </div>
  </section>
{:else if offline}
  <!-- Nothing saved yet and no signal: the checklist appears the first time there is a connection. -->
{/if}

<style>
  .supps {
    margin: 1.5rem 0 0.5rem;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.6rem;
  }
  h2 {
    margin: 0;
  }
  .count {
    font-size: var(--t-sm);
  }
  .manage {
    margin-left: auto;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: var(--muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0 0.9rem 0 0.6rem;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--text);
    font-weight: 500;
    transition:
      background-color 200ms var(--ease),
      box-shadow 200ms var(--ease);
  }
  .box {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    box-shadow: 0 0 0 1.5px var(--line-strong) inset;
    color: var(--accent-ink);
    transition: background-color 200ms var(--ease);
  }
  .pill.on {
    background: var(--accent-soft);
    box-shadow: 0 0 0 1px rgb(255 106 43 / 0.45) inset;
  }
  .pill.on .box {
    background: var(--accent);
    box-shadow: none;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
    color: var(--ember);
    font-size: var(--t-xs);
    font-weight: 600;
  }
</style>
