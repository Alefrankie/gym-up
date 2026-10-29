<script lang="ts">
  import type { SetType } from '@gym-up/contracts';
  import { setTypeOf } from '#lib/set-types';

  /** The small square that names a set: its letter (C, D, F) or, for a normal set, its number. */
  let { type, n, size = 'sm' }: { type: SetType | undefined; n?: number | string; size?: 'sm' | 'md' } = $props();
  const t = $derived(setTypeOf(type));
</script>

<b class="badge {size} st-{t.value}" title={t.label}>{t.short || n || '#'}</b>

<style>
  .badge {
    flex: none;
    display: inline-grid;
    place-items: center;
    border-radius: 5px;
    background: var(--raised);
    color: var(--muted);
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .sm {
    min-width: 1.15rem;
    height: 1.15rem;
    font-size: var(--t-xs);
  }
  .md {
    min-width: 1.75rem;
    height: 1.75rem;
    font-size: var(--t-sm);
  }
</style>
