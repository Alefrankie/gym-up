<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, onMount, type Snippet } from 'svelte';
  import { restTimer } from '#lib/offline/rest.svelte';
  import { WorkoutView } from '#lib/offline/workout-view.svelte';
  import { provideWorkoutView } from '#lib/offline/workout-context';
  import { t } from '#lib/i18n';
  import { coachLine } from '#lib/coach/coach.svelte';
  import { coachVoice } from '#lib/coach/voice.svelte';
  import { startWorkoutNotification, cancelWorkoutNotification } from '#lib/notify';
  import Icon from './Icon.svelte';
  import SyncBanner from './SyncBanner.svelte';

  let { id, children }: { id: string; children: Snippet } = $props();

  // The layout keys this component on the workout id, so the id never changes during its life.
  // svelte-ignore state_referenced_locally
  const view = new WorkoutView(id);
  provideWorkoutView(view);

  onMount(() => {
    void view.init((newId) => {
      // The server answered the start command with another workout of the day: keep the same screen, new id.
      void goto(page.url.pathname.replace(id, newId), { replaceState: true });
    });

    let scheduled = false;
    let away = false;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        away = true;
        // The rest timer already owns Android's one scheduled voice alarm.
        if (!coachVoice.enabled || !coachVoice.inApp || restTimer.seconds > 0 || !view.snap || view.isCompleted) return;
        const line = coachLine('leftApp');
        if (line) void coachVoice.scheduleAt(line.text, line.locale, Date.now() + 2500).then((ok) => {
          if (ok && away) scheduled = true;
          else if (ok) void coachVoice.cancelScheduled();
        });
        return;
      }

      away = false;
      if (scheduled) {
        scheduled = false;
        void coachVoice.cancelScheduled();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (scheduled) void coachVoice.cancelScheduled();
    };
  });
  $effect(() => {
    const snap = view.snap;
    if (!snap) return;
    if (view.isCompleted || snap.day || snap.editing) void cancelWorkoutNotification(snap.startedAt);
    else void startWorkoutNotification(snap.startedAt);
  });
  onDestroy(() => {
    view.destroy();
    if (view.snap) void cancelWorkoutNotification(view.snap.startedAt);
  });
</script>

<main>
  <SyncBanner />
  {#if restTimer.seconds > 0}
    <div class="rest-bar" role="timer" aria-label={t('workout.rest')}>
      <span class="clock"><span class="timer-icon"><Icon name="timer" size={17} /></span>{t('workout.rest')}<strong>{restTimer.label}</strong></span>
      <button type="button" class="skip" onclick={() => restTimer.skip()}>{t('workout.skip')}</button>
    </div>
  {/if}
  {#if view.error}<p class="error" role="alert">{view.error}</p>{/if}
  {#if !view.snap && !view.error}<p class="muted loading">{t('common.loading')}</p>{/if}
  {#if view.snap}{@render children()}{/if}
</main>

<style>
  .rest-bar {
    position: sticky;
    top: calc(env(safe-area-inset-top) + 0.35rem);
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: 52px;
    margin-bottom: 0.75rem;
    padding: 0.25rem 0.35rem 0.25rem 0.75rem;
    border-radius: 14px;
    background: var(--surface-hi);
    box-shadow: 0 0 0 1px var(--line-strong) inset;
    color: var(--text);
  }
  .clock {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--t-sm);
    font-weight: 600;
    color: var(--muted);
  }
  .timer-icon {
    display: grid;
    place-items: center;
    color: var(--accent-hi);
  }
  .clock strong {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--t-xl);
    line-height: 1;
    color: var(--accent-hi);
  }
  .skip {
    min-height: 40px;
    padding: 0 0.8rem;
    border-radius: 10px;
    background: var(--accent-soft);
    box-shadow: none;
    color: var(--accent-hi);
    font-size: var(--t-sm);
  }
</style>
