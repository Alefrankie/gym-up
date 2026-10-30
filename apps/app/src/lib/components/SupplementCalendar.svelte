<script lang="ts">
  import { t, dateLocale } from '#lib/i18n';
  import type { SupplementDto } from '@gym-up/contracts';
  import Icon from './Icon.svelte';

  /**
   * A month of supplements: each day shows one coloured dot per supplement taken, so a missed creatine
   * day stands out at a glance. Months go back as far as the history the API sends (about two).
   */
  let { items, today }: { items: SupplementDto[]; today: string } = $props();

  const COLORS = ['var(--accent)', 'var(--info)', 'var(--ok)', 'var(--ember)', '#c792ea', '#f07178'];
  const colorOf = (i: number) => COLORS[i % COLORS.length]!;

  let offset = $state(0); // 0 = this month, -1 = last month
  const month = $derived.by(() => {
    const base = new Date(`${today}T12:00:00`);
    return new Date(base.getFullYear(), base.getMonth() + offset, 1);
  });
  const title = $derived(month.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase()));

  const cells = $derived.by(() => {
    const p = (n: number) => String(n).padStart(2, '0');
    const y = month.getFullYear();
    const m = month.getMonth();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
    const count = new Date(y, m + 1, 0).getDate();
    const out: ({ key: string; num: number; taken: number[]; future: boolean } | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) {
      const key = `${y}-${p(m + 1)}-${p(d)}`;
      out.push({ key, num: d, taken: items.flatMap((s, i) => (s.days.includes(key) ? [i] : [])), future: key > today });
    }
    return out;
  });

  /** Share of the days so far this month on which each supplement was taken. */
  const adherence = $derived.by(() => {
    const past = cells.filter((c) => c && !c.future).length || 1;
    return items.map((s, i) => ({ name: s.name, color: colorOf(i), pct: Math.round((cells.filter((c) => c?.taken.includes(i)).length / past) * 100) }));
  });
</script>

<section class="cal">
  <header>
    <button type="button" class="icon ghost" aria-label={t('supplements.prevMonth')} disabled={offset <= -1} onclick={() => offset--}><Icon name="left" size={18} /></button>
    <strong>{title}</strong>
    <button type="button" class="icon ghost" aria-label={t('supplements.nextMonth')} disabled={offset >= 0} onclick={() => offset++}><Icon name="right" size={18} /></button>
  </header>
  <div class="grid" role="grid" aria-label={t('supplements.monthLabel', { month: title })}>
    {#each t('supplements.weekdays').split(',') as l, i (i)}<span class="wd">{l}</span>{/each}
    {#each cells as c, i (c?.key ?? `pad-${i}`)}
      {#if c}
        <span class="day" class:today={c.key === today} class:future={c.future} class:full={c.taken.length === items.length && items.length > 0}>
          <span class="num">{c.num}</span>
          <span class="dots">{#each c.taken as ti (ti)}<i style:background={colorOf(ti)}></i>{/each}</span>
        </span>
      {:else}
        <span></span>
      {/if}
    {/each}
  </div>
  <ul class="legend">
    {#each adherence as a (a.name)}
      <li>
        <i style:background={a.color}></i>
        <span class="name">{a.name}</span>
        <span class="track"><span style:width={`${a.pct}%`} style:background={a.color}></span></span>
        <span class="pct">{a.pct}%</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .cal {
    padding: 1rem;
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  header strong {
    font-weight: 600;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }
  .wd {
    text-align: center;
    color: var(--faint);
    font-size: var(--t-xs);
    font-weight: 600;
    padding-bottom: 0.25rem;
  }
  .day {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 3px;
    aspect-ratio: 1;
    border-radius: 10px;
    background: var(--surface-hi);
  }
  .day.full {
    box-shadow: 0 0 0 1.5px var(--accent) inset;
  }
  .day.today .num {
    color: var(--accent-hi);
  }
  .day.future {
    background: none;
  }
  .day.future .num {
    color: var(--faint);
  }
  .num {
    font-size: var(--t-xs);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .dots {
    display: flex;
    gap: 2px;
    min-height: 5px;
  }
  .dots i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }
  .legend {
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .legend li {
    display: grid;
    grid-template-columns: 10px 6.5rem 1fr 2.5rem;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--t-sm);
  }
  .legend i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-hi);
    overflow: hidden;
  }
  .track span {
    display: block;
    height: 100%;
    border-radius: 3px;
  }
  .pct {
    text-align: right;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>
