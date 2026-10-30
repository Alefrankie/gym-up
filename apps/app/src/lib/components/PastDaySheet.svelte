<script lang="ts">
  import { t } from '#lib/i18n';
  import { localDay, relativeDay } from '#lib/dates';
  import Sheet from './Sheet.svelte';

  /**
   * Pick an earlier day to log a workout done before (or away from) the app: the last week in one tap,
   * anything older (up to 60 days) from the date field.
   */
  let { onpick, onclose }: { onpick: (day: string) => void; onclose: () => void } = $props();

  const today = localDay();
  const ago = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return localDay(d);
  };
  const recent = Array.from({ length: 7 }, (_, i) => ago(i + 1));
  let other = $state('');
</script>

<Sheet title={t('routine.logPastTitle')} {onclose}>
  <p class="muted hint">{t('routine.logPastHint')}</p>
  <div class="days">
    {#each recent as d (d)}
      <button type="button" class="day" onclick={() => onpick(d)}>{relativeDay(d, today)}</button>
    {/each}
  </div>
  <label class="other">
    {t('routine.otherDate')}
    <span class="row">
      <input type="date" min={ago(60)} max={ago(1)} bind:value={other} />
      <button type="button" class="primary" disabled={!other} onclick={() => onpick(other)}>{t('common.add')}</button>
    </span>
  </label>
</Sheet>

<style>
  .hint {
    margin: -0.25rem 0 1rem;
    font-size: var(--t-sm);
  }
  .days {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  .day {
    min-height: 48px;
    text-transform: capitalize;
  }
  .other {
    margin-top: 1.25rem;
  }
  .row {
    display: flex;
    gap: 0.5rem;
  }
  .row input {
    flex: 1;
    color-scheme: dark;
  }
  .row .primary {
    width: auto;
    margin: 0;
    padding: 0 1.25rem;
  }
</style>
