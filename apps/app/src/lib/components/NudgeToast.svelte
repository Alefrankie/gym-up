<script lang="ts">
  import { nudge } from '#lib/nudge.svelte';
  import { t } from '#lib/i18n';
  import FloatingNotice from './FloatingNotice.svelte';
  import Icon from './Icon.svelte';

  let { workout = false }: { workout?: boolean } = $props();
</script>

{#if nudge.text}
  <FloatingNotice placement={workout ? 'workout' : 'top'} ondismiss={() => nudge.hide()}>
    <div class="content" role="status">
      <span class="badge"><Icon name={nudge.kind === 'coach' ? 'bolt' : 'check'} size={18} /></span>
      <span class="message">
        {#if nudge.kind === 'coach'}<strong>{t('workout.coachNotice')}</strong>{/if}
        <span>{nudge.text}</span>
      </span>
    </div>
  </FloatingNotice>
{/if}

<style>
  .content {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem;
    font-weight: 650;
    line-height: 1.3;
  }
  .badge {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--accent-soft);
    color: var(--accent-hi);
  }
  .message { display: grid; gap: 0.15rem; }
  .message strong { color: var(--accent-hi); font-size: var(--t-xs); }
</style>
