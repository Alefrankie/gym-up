<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import WorkoutShell from '#lib/components/WorkoutShell.svelte';

  let { children }: { children: Snippet } = $props();
</script>

{#key page.params.id}
  <WorkoutShell id={page.params.id ?? ''}>
    {@render children()}
  </WorkoutShell>
{/key}
