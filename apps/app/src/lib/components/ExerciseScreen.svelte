<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte';
  import ExerciseInfo from './ExerciseInfo.svelte';
  import type { IconName } from './Icon.svelte';
  import Overlay from './Overlay.svelte';
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

<Overlay {title} {onclose}>
  {#snippet trailing()}{#if actions.length}<OverflowMenu items={actions} />{:else}<span></span>{/if}{/snippet}
  <ExerciseInfo {exercise} />
  {#if children}
    <section class="settings">
      {@render children()}
    </section>
  {/if}
</Overlay>

<style>
  .settings {
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
</style>
