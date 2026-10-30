<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { sync } from '#lib/offline/sync.svelte';
  import { i18n } from '#lib/i18n';

  let { children } = $props();

  // The sync loop runs for the whole life of the app, whichever screen is open.
  onMount(() => sync.start());

  // Screen readers and the keyboard use the page language; keep it in step with the chosen one.
  $effect(() => {
    document.documentElement.lang = i18n.locale;
  });

</script>

{@render children()}
