<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { tokenStore } from '#lib/api/token';

  onMount(() => {
    if (!tokenStore.get()) goto('/login', { replaceState: true });
  });

  function logout() {
    tokenStore.clear();
    goto('/login', { replaceState: true });
  }
</script>

<main>
  <h1>Inicio</h1>
  <p>La app móvil está en construcción.</p>
  <button onclick={logout}>Salir</button>
</main>
