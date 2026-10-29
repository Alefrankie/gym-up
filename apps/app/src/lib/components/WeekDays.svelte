<script lang="ts">
  import Icon from './Icon.svelte';

  /** This week, Monday to Sunday: a filled circle for each day trained, a ring around today. */
  let { trained, today }: { trained: string[]; today: string } = $props();

  const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const days = $derived.by(() => {
    const on = new Set(trained);
    const t = new Date(`${today}T12:00:00`);
    const monday = new Date(t);
    monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return LETTERS.map((letter, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const p = (n: number) => String(n).padStart(2, '0');
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      return { letter, key, num: d.getDate(), on: on.has(key), isToday: key === today, future: key > today };
    });
  });
</script>

<ol class="week" aria-label="Días entrenados esta semana">
  {#each days as d (d.key)}
    <li class:on={d.on} class:today={d.isToday} class:future={d.future} aria-label={`${d.letter} ${d.num}${d.on ? ', entrenado' : ''}`}>
      <span class="letter">{d.letter}</span>
      <span class="dot">{#if d.on}<Icon name="check" size={16} />{:else}{d.num}{/if}</span>
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
