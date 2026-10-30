<script lang="ts">
  import { t } from '#lib/i18n';
  import Icon from './Icon.svelte';

  /** This week, Monday to Sunday: a filled circle for each day trained, a ring around today. */
  /** `onpick` makes today and past days tappable (to log a workout on that day). */
  let { trained, today, onpick }: { trained: string[]; today: string; onpick?: (day: string) => void } = $props();

  const days = $derived.by(() => {
    const LETTERS = [...t('week.letters')];
    const on = new Set(trained);
    const base = new Date(`${today}T12:00:00`);
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    return LETTERS.map((letter, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const p = (n: number) => String(n).padStart(2, '0');
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      return { letter, key, num: d.getDate(), on: on.has(key), isToday: key === today, future: key > today };
    });
  });
</script>

<ol class="week" aria-label={t('week.label')}>
  {#each days as d (d.key)}
    <li class:on={d.on} class:today={d.isToday} class:future={d.future} aria-label={`${d.letter} ${d.num}${d.on ? t('week.trained') : ''}`}>
      <span class="letter">{d.letter}</span>
      {#if onpick && !d.future}
        <button type="button" class="dot" onclick={() => onpick(d.key)}>{#if d.on}<Icon name="check" size={16} />{:else}{d.num}{/if}</button>
      {:else}
        <span class="dot">{#if d.on}<Icon name="check" size={16} />{:else}{d.num}{/if}</span>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .week {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
  }
  li {
    display: grid;
    justify-items: center;
    gap: 0.35rem;
  }
  .letter {
    color: var(--muted);
    font-size: var(--t-xs);
    font-weight: 600;
  }
  button.dot {
    min-height: 0;
    padding: 0;
  }
  .dot {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    transition: background-color 300ms var(--ease);
  }
  .future .dot {
    background: none;
    color: var(--faint);
  }
  .today .dot {
    box-shadow: 0 0 0 2px var(--accent) inset;
    color: var(--text);
  }
  .today .letter {
    color: var(--accent-hi);
  }
  .on .dot {
    background: var(--accent);
    box-shadow: none;
    color: var(--accent-ink);
  }
</style>
