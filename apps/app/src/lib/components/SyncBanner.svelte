<script lang="ts">
  import { sync } from '#lib/offline/sync.svelte';
</script>

{#if sync.pending > 0 || sync.failed.length > 0}
  <div class="banner" class:warn={sync.offline} role="status">
    {#if sync.pending > 0}
      <span>
        {sync.offline ? 'Sin conexión' : sync.syncing ? 'Sincronizando' : 'Pendiente'}:
        {sync.pending} {sync.pending === 1 ? 'cambio' : 'cambios'} por enviar
      </span>
      {#if !sync.syncing}
        <button type="button" onclick={() => sync.kick(true)}>Reintentar</button>
      {/if}
    {/if}
  </div>
  {#each sync.failed as item (item.seq)}
    <div class="banner err" role="alert">
      <span>No se pudo guardar un cambio ({item.error}).</span>
      <span class="actions">
        <button type="button" onclick={() => sync.retry(item.seq)}>Reintentar</button>
        <button type="button" onclick={() => sync.discard(item.seq)}>Descartar</button>
      </span>
    </div>
  {/each}
{/if}

<style>
  .banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin: 0.5rem 0;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: #1e3a8a;
    font-size: 0.9rem;
  }
  .banner.warn {
    background: #78350f;
  }
  .banner.err {
    background: #7f1d1d;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  button {
    padding: 0.35rem 0.6rem;
  }
</style>
