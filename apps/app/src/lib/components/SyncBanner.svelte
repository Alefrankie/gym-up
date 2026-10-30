<script lang="ts">
  import { t, tn } from '#lib/i18n';
  import { sync } from '#lib/offline/sync.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  // A change that reaches the server within a few seconds is nothing to report: only offline or stuck sends show.
  let stuck = $state(false);
  $effect(() => {
    if (sync.pending === 0) {
      stuck = false;
      return;
    }
    const timer = setTimeout(() => (stuck = true), 5000);
    return () => clearTimeout(timer);
  });
  const show = $derived((sync.pending > 0 && (sync.offline || stuck)) || sync.failed.length > 0);
</script>

<!-- Floats above the bottom bar so it never pushes the screen around. -->
{#if show}
<div class="dock" transition:fly={{ y: 16, duration: 220, easing: cubicOut }}>
  {#if sync.pending > 0 && (sync.offline || stuck)}
  <div class="banner" class:warn={sync.offline} role="status">
    {#if sync.pending > 0}
      <span class="msg">
        <Icon name="cloud" size={16} />
        <span>
          {sync.offline ? t('sync.offline') : sync.syncing ? t('sync.syncing') : t('sync.pending')}:
          {tn('sync.changesToSend', sync.pending)}
        </span>
      </span>
      {#if !sync.syncing}
        <button type="button" onclick={() => sync.kick(true)}>{t('sync.retry')}</button>
      {/if}
    {/if}
  </div>
  {/if}
  {#each sync.failed as item (item.seq)}
    <div class="banner err" role="alert">
      <span class="msg">
        <Icon name="x" size={16} />
        <span>{t('sync.failed', { error: item.error })}</span>
      </span>
      <span class="actions">
        <button type="button" onclick={() => sync.retry(item.seq)}>{t('sync.retry')}</button>
        <button type="button" class="ghost" onclick={() => sync.discard(item.seq)}>{t('sync.discard')}</button>
      </span>
    </div>
  {/each}
</div>
{/if}

<style>
  .dock {
    position: fixed;
    left: 1rem;
    right: 1rem;
    bottom: calc(5.5rem + env(safe-area-inset-bottom));
    z-index: 30;
    max-width: 32rem;
    margin: 0 auto;
    display: grid;
    gap: 0.4rem;
    pointer-events: none;
  }
  .dock > :global(*) {
    pointer-events: auto;
  }
  .banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    padding: 0.3rem 0.3rem 0.3rem 0.75rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    font-size: var(--t-sm);
    color: var(--text);
  }
  .msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--ember);
  }
  .msg span {
    color: var(--text);
  }
  .banner.warn .msg {
    color: var(--muted);
  }
  .banner.err .msg {
    color: var(--danger);
  }
  .actions {
    display: flex;
    gap: 0.25rem;
  }
  button {
    min-height: 40px;
    padding: 0.3rem 0.75rem;
    font-size: var(--t-sm);
  }
</style>
