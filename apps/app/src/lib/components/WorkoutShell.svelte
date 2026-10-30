<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, onMount, type Snippet } from 'svelte';
  import { restTimer } from '#lib/offline/rest.svelte';
  import { WorkoutView } from '#lib/offline/workout-view.svelte';
  import { provideWorkoutView } from '#lib/offline/workout-context';
  import { t } from '#lib/i18n';
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
  });
  onDestroy(() => view.destroy());
</script>

{#if restTimer.seconds > 0}
  <div class="rest" role="timer" aria-label={t('workout.rest')}>
    <span class="clock"><Icon name="timer" size={16} /> {t('workout.rest')} <strong>{restTimer.label}</strong></span>
    <button type="button" class="skip" onclick={() => restTimer.skip()}>{t('workout.skip')}</button>
  </div>
{/if}

<main>
  <SyncBanner />
  {#if view.error}<p class="error" role="alert">{view.error}</p>{/if}
  {#if !view.snap && !view.error}<p class="muted loading">{t('common.loading')}</p>{/if}
  {#if view.snap}{@render children()}{/if}
</main>

<style>
  .rest {
    position: fixed;
    top: calc(env(safe-area-inset-top) + 0.5rem);
    left: 1rem;
    right: 1rem;
    max-width: 32rem;
    margin: 0 auto;
    z-index: 20;
    gap: 0.75rem;
    min-height: 48px;
    padding: 0.25rem 0.25rem 0.25rem 0.9rem;
  }
  .clock {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .clock strong {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--t-xl);
    line-height: 1;
  }
  .skip {
    min-height: 40px;
    padding: 0 0.9rem;
    background: rgb(28 13 5 / 0.16);
    box-shadow: none;
    color: var(--accent-ink);
    font-size: var(--t-sm);
  }
</style>
