<script lang="ts">
  import { t } from '#lib/i18n';
  import { onMount } from 'svelte';
  import FloatingNotice from './FloatingNotice.svelte';

  let { message, onundo, ondismiss }: { message: string; onundo: () => void; ondismiss: () => void } = $props();

  onMount(() => {
    const timer = setTimeout(ondismiss, 5000);
    return () => clearTimeout(timer);
  });
</script>

<FloatingNotice placement="bottom" {ondismiss}>
  <div class="content">
    <span role="status">{message}</span>
    <button type="button" onclick={onundo}>{t('common.undo')}</button>
  </div>
</FloatingNotice>

<style>
  .content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    font-weight: 650;
    line-height: 1.3;
  }
  button {
    min-height: 44px;
    padding: 0 0.65rem;
    background: var(--accent-soft);
    box-shadow: none;
    color: var(--accent-hi);
  }
</style>
