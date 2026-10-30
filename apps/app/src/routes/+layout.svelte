<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { sync } from '#lib/offline/sync.svelte';
  import { i18n } from '#lib/i18n';
  import NudgeToast from '#lib/components/NudgeToast.svelte';
  import UpdateBanner from '#lib/components/UpdateBanner.svelte';

  let { children } = $props();

  // The sync loop runs for the whole life of the app, whichever screen is open.
  onMount(() => {
    sync.start();

    // The Android WebView has its own native offline storage and does not need this worker.
    if (
      !import.meta.env.DEV &&
      'serviceWorker' in navigator &&
      window.location.protocol === 'https:' &&
      !('__TAURI_INTERNALS__' in window)
    ) {
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  });

  // Screen readers and the keyboard use the page language; keep it in step with the chosen one.
  $effect(() => {
    document.documentElement.lang = i18n.locale;
  });

</script>

{@render children()}

<NudgeToast />
<UpdateBanner />
