<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { t } from '#lib/i18n';
  import ExerciseInfo from './ExerciseInfo.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import OverflowMenu from './OverflowMenu.svelte';

  /**
   * One exercise on its own screen, over the current one: what it is and how to do it in the middle,
   * the screen's own settings (e.g. the sets of a routine) underneath. Back closes it.
   */
  let {
    title,
    exercise,
    actions = [],
    onclose,
    children,
  }: {
    title: string;
    exercise: ComponentProps<typeof ExerciseInfo>['exercise'];
    actions?: { label: string; icon: IconName; danger?: boolean; onselect: () => void }[];
    onclose: () => void;
    children?: Snippet;
  } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="screen" role="dialog" aria-modal="true" aria-label={title} transition:fly={{ x: 40, duration: 260, easing: cubicOut }}>
  <header>
    <button type="button" class="round" aria-label={t('common.back')} onclick={onclose}><Icon name="left" size={20} /></button>
    <h1>{title}</h1>
    {#if actions.length}<OverflowMenu items={actions} />{:else}<span></span>{/if}
  </header>
  <div class="body">
    <ExerciseInfo {exercise} />
    {#if children}
      <section class="settings">
        {@render children()}
      </section>
    {/if}
  </div>
</div>

<style>
  .screen {
    position: fixed;
    inset: 0;
    z-index: 45;
    overflow-y: auto;
    background: var(--bg);
    padding: calc(env(safe-area-inset-top) + 0.5rem) 1rem calc(6rem + env(safe-area-inset-bottom));
  }
  header {
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  h1 {
    margin: 0;
    font-size: var(--t-lg);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .round {
    display: grid;
    place-items: center;
    width: 40px;
    min-height: 40px;
    padding: 0;
    border-radius: 50%;
    background: var(--surface);
  }
  .body {
    max-width: 34rem;
    margin: 0 auto;
  }
  .settings {
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
</style>
