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
    justify-content: space-between;
    gap: 0.75rem;
    min-height: 48px;
    margin-top: 0.8rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }
  .rest-copy {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--accent-hi);
  }
  .rest-label {
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .rest-copy strong {
    color: var(--accent-hi);
    font-family: var(--font-display);
    font-size: var(--t-xl);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .skip {
    min-width: 64px;
    min-height: 48px;
    padding: 0 0.5rem;
    background: transparent;
    box-shadow: none;
    color: var(--accent-hi);
    font-size: var(--t-sm);
    font-weight: 600;
  }
</style>
