<script lang="ts">
  import { onMount } from 'svelte';
  import type { SupplementListResponse } from '@gym-up/contracts';
  import { NetworkError } from '#lib/api/errors';
  import { shortDay } from '#lib/dates';
  import { localDay } from '#lib/dates';
  import { loadSupplements, persistMark, withMark } from '#lib/supplements';
  import { t, tn } from '#lib/i18n';
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

  /** The 7 days ending today, oldest first, with their weekday letter. */
  function last7(today: string) {
    // Weekday letters come Monday-first; getDay() counts from Sunday.
    const L = t('week.letters');
    const base = new Date(`${today}T12:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - (6 - i));
      return { key: localDay(d), letter: L[(d.getDay() + 6) % 7]! };
    });
  }

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
  <section class="supps" aria-label={t('supps.todayLabel')}>
    <header>
      <div class="title">
        <h2>{t('supps.title')}</h2>
        <span class="muted count">{t('supps.summary', { day: shortDay(list.day), done, total: list.items.length })}</span>
      </div>
      <a class="manage" href="/supplements">{t('supps.history')} <Icon name="right" size={16} /></a>
    </header>
    {#if list.items.length <= 2}
      <!-- With one or two supplements a chip looks lost: each gets a full row with its last 7 days. -->
      <div class="rows">
        {#each list.items as s (s.id)}
          <button type="button" class="tile" class:on={s.taken} aria-pressed={s.taken} onclick={() => toggle(s.id, !s.taken)}>
            <span class="big" aria-hidden="true">{#if s.taken}<Icon name="check" size={22} />{/if}</span>
            <span class="info">
              <strong>{s.name}</strong>
              {#if s.taken || s.streak > 1}
                <span class="muted">
                  {#if s.taken}{t('supps.doneToday')}{/if}{#if s.taken && s.streak > 1}{' · '}{/if}{#if s.streak > 1}<span class="streak-text">{tn('supps.streak', s.streak)}</span>{/if}
                </span>
              {/if}
            </span>
            <span class="week" aria-label={t('supps.last7')}>
              {#each last7(list.day) as d (d.key)}
                <span class="wd"><i class:on={s.days.includes(d.key)} class:today={d.key === list.day}></i><small>{d.letter}</small></span>
              {/each}
            </span>
          </button>
        {/each}
      </div>
    {:else}
    <div class="chips">
      {#each list.items as s (s.id)}
        <button type="button" class="pill" class:on={s.taken} aria-pressed={s.taken} onclick={() => toggle(s.id, !s.taken)}>
          <span class="box" aria-hidden="true">{#if s.taken}<Icon name="check" size={14} />{/if}</span>
          <span class="name">{s.name}</span>
          {#if s.streak > 1}<span class="streak"><Icon name="flame" size={12} />{s.streak}</span>{/if}
        </button>
      {/each}
    </div>
    {/if}
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
  .title {
    display: grid;
    gap: 0.1rem;
  }
  .manage {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    min-height: 40px;
    font-size: var(--t-sm);
    font-weight: 600;
    text-decoration: none;
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
  .rows {
    display: grid;
    gap: 0.5rem;
  }
  .tile {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-height: 72px;
    padding: 0.75rem 1rem 0.75rem 0.75rem;
    border-radius: 18px;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
    text-align: left;
    color: var(--text);
    transition:
      background-color 200ms var(--ease),
      box-shadow 200ms var(--ease);
  }
  .tile.on {
    background: var(--accent-soft);
    box-shadow: 0 0 0 1px rgb(255 106 43 / 0.45) inset;
  }
  .big {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--line-strong) inset;
    color: var(--accent-ink);
    transition: background-color 200ms var(--ease);
  }
  .tile.on .big {
    background: var(--accent);
    box-shadow: none;
  }
  .info {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.1rem;
  }
  .info strong {
    font-weight: 600;
  }
  .info .muted {
    font-size: var(--t-sm);
    font-weight: 400;
  }
  .streak-text {
    color: var(--ember);
  }
  .week {
    display: flex;
    gap: 5px;
  }
  .wd {
    display: grid;
    justify-items: center;
    gap: 3px;
  }
  .wd i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--raised);
  }
  .wd i.on {
    background: var(--accent);
  }
  .wd i.today {
    box-shadow: 0 0 0 1.5px var(--text);
  }
  .wd small {
    color: var(--faint);
    font-size: 9px;
    font-weight: 600;
  }
</style>
