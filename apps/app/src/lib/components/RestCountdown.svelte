<script lang="ts">
  import { restTimer } from '#lib/offline/rest.svelte';
  import { t } from '#lib/i18n';
  import Icon from './Icon.svelte';
</script>

{#if restTimer.seconds > 0}
  <div class="rest-countdown" role="timer" aria-label={`${t('workout.rest')} ${restTimer.label}`} style:--left={restTimer.progress}>
    <span class="rest-label"><Icon name="timer" size={16} />{t('workout.rest')}</span>
    <div class="clock">
      <button type="button" class="step" onclick={() => restTimer.adjust(-15)} aria-label="-15 s">−15s</button>
      <strong>{restTimer.label}</strong>
      <button type="button" class="step" onclick={() => restTimer.adjust(15)} aria-label="+15 s">+15s</button>
    </div>
    <button type="button" class="skip" onclick={() => restTimer.skip()} aria-label={t('workout.skip')}><span></span></button>
  </div>
{/if}

<style>
  .rest-countdown {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 56px;
    padding: 0 0.4rem 0 0.85rem;
    overflow: hidden;
    border: 1px solid var(--accent);
    border-radius: 14px;
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  }
  /* The remaining-time fill runs behind all the controls. */
  .rest-countdown::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--accent-soft);
    transform: scaleX(var(--left));
    transform-origin: left;
    transition: transform 0.25s linear;
    pointer-events: none;
  }
  .rest-label {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--accent-hi);
    font-size: var(--t-xs);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .clock {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
  }
  .clock strong {
    min-width: 3.4ch;
    padding-inline: 0.6rem;
    border-inline: 1px solid var(--line-strong);
    color: var(--text);
    font-family: var(--font-display);
    font-size: var(--t-num);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-align: center;
  }
  .step {
    min-width: 48px;
    min-height: 44px;
    padding: 0 0.4rem;
    background: none;
    box-shadow: none;
    color: var(--muted);
    font-family: var(--font-display);
    font-size: var(--t-lg);
  }
  .skip {
    position: relative;
    display: grid;
    flex: 0 0 44px;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--text) 8%, transparent);
    box-shadow: none;
  }
  .skip span {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    background: var(--text);
  }
</style>
