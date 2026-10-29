<script lang="ts">
  import { tokenStore } from '#lib/api/token';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto(tokenStore.get() ? '/dashboard' : '/login', { replaceState: true });
  });
</script>

<main>
  <p>Cargando…</p>
</main>
