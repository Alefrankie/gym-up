<script lang="ts">
  import { restTimer } from '#lib/offline/rest.svelte';
  import { t } from '#lib/i18n';
  import Icon from './Icon.svelte';
</script>

{#if restTimer.seconds > 0}
  <div class="rest-countdown" role="timer" aria-label={`${t('workout.rest')} ${restTimer.label}`}>
    <span class="rest-copy">
      <Icon name="timer" size={18} />
      <span class="rest-label">{t('workout.rest')}</span>
      <strong>{restTimer.label}</strong>
    </span>
    <button type="button" class="skip" onclick={() => restTimer.skip()}>{t('workout.skip')}</button>
  </div>
{/if}

<style>
  .rest-countdown {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 48px;
    flex: none;
    padding: 0 0.5rem 0 0.65rem;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface-hi);
  }
  .rest-copy {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--accent-hi);
  }
  .rest-label {
    color: var(--muted);
    font-size: var(--t-xs);
    font-weight: 600;
  }
  .rest-copy strong {
    color: var(--accent-hi);
    font-family: var(--font-display);
    font-size: var(--t-lg);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .skip {
    min-width: 48px;
    min-height: 48px;
    padding: 0 0.35rem;
    border-radius: 9px;
    background: var(--accent-soft);
    box-shadow: none;
    color: var(--accent-hi);
    font-size: var(--t-sm);
    font-weight: 600;
  }
</style>
