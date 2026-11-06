<script lang="ts">
  import { t } from '#lib/i18n';

  /**
   * Five stars. Read-only shows the recipe's average; `onrate` turns them into the viewer's 1–5 control.
   * Authors cannot rate their own recipe, so the parent simply does not pass `onrate`.
   */
  let {
    value,
    viewer = null,
    onrate,
    busy = false,
    size = 22,
  }: {
    /** Average shown when there is no interactive control. Null = nobody rated it. */
    value: number | null;
    /** The viewer's own vote, which is what an interactive row fills. */
    viewer?: number | null;
    onrate?: (rating: number) => void;
    busy?: boolean;
    size?: number;
  } = $props();

  const filled = $derived(onrate ? (viewer ?? 0) : Math.round(value ?? 0));
  const STARS = [1, 2, 3, 4, 5];
</script>

{#if onrate}
  <div class="stars" role="group" style={`--s:${size}px`}>
    {#each STARS as n (n)}
      <button
        type="button"
        class="star"
        class:on={n <= filled}
        aria-label={t('recipes.rateStars', { n })}
        aria-pressed={viewer === n}
        disabled={busy}
        onclick={() => onrate(n)}>★</button
      >
    {/each}
  </div>
{:else}
  <span class="stars" aria-hidden="true" style={`--s:${size}px`}>
    {#each STARS as n (n)}
      <span class="star" class:on={n <= filled}>{n <= filled ? '★' : '☆'}</span>
    {/each}
  </span>
{/if}

<style>
  .stars {
    display: inline-flex;
    align-items: center;
    gap: 0.05rem;
    line-height: 1;
    color: var(--line-strong);
    font-size: var(--s);
  }
  .star {
    min-height: 0;
    height: var(--s);
    padding: 0;
    border-radius: 4px;
    background: none;
    box-shadow: none;
    color: inherit;
    font-size: var(--s);
    line-height: 1;
  }
  .star.on {
    color: var(--ember);
  }
  button.star {
    /* A tap target big enough for a thumb without spreading the row apart. */
    width: calc(var(--s) + 6px);
    padding: 0;
  }
  button.star:disabled {
    opacity: 0.5;
  }
</style>
