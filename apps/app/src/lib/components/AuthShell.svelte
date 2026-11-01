<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    lead,
    children,
    actions,
  }: { title: string; lead: string; children: Snippet; actions: Snippet } = $props();
</script>

<div class="shell">
  <header class="brand">
    <span class="mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" width="34" height="34" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 26v-8M11 29V15M37 29V15M42 26v-8M11 22h26"/><path d="M24 40V28M19 33l5-5 5 5"/></svg>
    </span>
    <span class="word">Gym Up</span>
  </header>

  <div class="body">
    <h1>{title}</h1>
    <p class="lead">{lead}</p>
    {@render children()}
  </div>

  <footer class="actions">
    {@render actions()}
  </footer>
</div>

<style>
  .shell {
    min-height: 100dvh;
    max-width: 29rem;
    margin: 0 auto;
    padding: calc(env(safe-area-inset-top) + 1.5rem) 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  @media (max-height: 700px) {
    .shell {
      justify-content: flex-start;
    }
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .mark {
    display: grid;
    place-items: center;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--accent-ink);
  }
  .mark svg {
    width: 1.15rem;
    height: 1.15rem;
  }
  .word {
    font-weight: 650;
    font-size: var(--t-md);
    letter-spacing: -0.01em;
  }
  .body {
    margin-top: 2.25rem;
    padding: 1.5rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.025) inset, var(--shadow-pop);
  }
  h1 {
    margin: 0;
    font-family: var(--font-body);
    font-weight: 650;
    font-size: var(--t-xl);
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .lead {
    margin: 0.5rem 0 1.5rem;
    color: var(--muted);
    font-size: var(--t-base);
    line-height: 1.45;
  }
  .actions {
    display: grid;
    gap: 0.5rem;
    padding-top: 1rem;
    padding-inline: 1.5rem;
  }
  .actions :global(.alt) {
    margin: 0;
    text-align: center;
    color: var(--muted);
  }
  .actions :global(.alt a) {
    display: inline-block;
    padding: 0.7rem 0.25rem;
    color: var(--text);
    font-weight: 600;
    text-underline-offset: 0.25em;
    text-decoration-color: var(--accent);
  }
  .actions :global(.primary) {
    margin-top: 0;
    min-height: 48px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    box-shadow: none;
    font-size: var(--t-base);
    font-weight: 650;
  }
  .actions :global(.primary:active:not(:disabled)) {
    background: var(--accent-hi);
  }
  /* Flat, filled fields: quiet until focused. */
  .body :global(label),
  .body :global(legend) {
    font-size: var(--t-sm);
    font-weight: 500;
    color: var(--muted);
    letter-spacing: 0.01em;
  }
  .body :global(input:not([type='radio'])) {
    min-height: 48px;
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
    font-size: var(--t-base);
  }
  .body :global(input:not([type='radio']):focus) {
    box-shadow: 0 0 0 1.5px var(--accent) inset, 0 0 0 4px var(--accent-soft);
  }
  /* Browser autofill paints its own blue; keep it on the palette. */
  .body :global(input:-webkit-autofill) {
    -webkit-text-fill-color: var(--text);
    caret-color: var(--accent);
    box-shadow: 0 0 0 1px var(--line) inset, 0 0 0 100px var(--surface) inset;
  }
  .body :global(label small) {
    color: var(--muted);
    font-size: var(--t-xs);
    line-height: 1.4;
  }
  @media (min-width: 520px) {
    .shell {
      padding-inline: 2rem;
    }
    .body {
      padding: 2rem;
    }
  }
</style>
