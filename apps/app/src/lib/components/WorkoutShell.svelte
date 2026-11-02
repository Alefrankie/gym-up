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
  {#if view.error}<p class="error" role="alert">{view.error}</p>{/if}
  {#if !view.snap && !view.error}<p class="muted loading">{t('common.loading')}</p>{/if}
  {#if view.snap}{@render children()}{/if}
</main>

<style>
</style>
