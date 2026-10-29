<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { sync } from '#lib/offline/sync.svelte';

  let { children } = $props();

  // The sync loop runs for the whole life of the app, whichever screen is open.
  onMount(() => sync.start());
</script>

{@render children()}
