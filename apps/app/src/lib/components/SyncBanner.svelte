<script lang="ts">
  import { sync } from '#lib/offline/sync.svelte';
  import Icon from '#lib/components/Icon.svelte';
</script>

{#if sync.pending > 0 || sync.failed.length > 0}
  <div class="banner" class:warn={sync.offline} role="status">
    {#if sync.pending > 0}
      <span class="msg">
        <Icon name="cloud" size={16} />
        <span>
          {sync.offline ? 'Sin conexión' : sync.syncing ? 'Sincronizando' : 'Pendiente'}:
          {sync.pending} {sync.pending === 1 ? 'cambio' : 'cambios'} por enviar
        </span>
      </span>
      {#if !sync.syncing}
        <button type="button" onclick={() => sync.kick(true)}>Reintentar</button>
      {/if}
    {/if}
  </div>
  {#each sync.failed as item (item.seq)}
    <div class="banner err" role="alert">
      <span class="msg">
        <Icon name="x" size={16} />
        <span>No se pudo guardar un cambio ({item.error}).</span>
      </span>
      <span class="actions">
        <button type="button" onclick={() => sync.retry(item.seq)}>Reintentar</button>
        <button type="button" class="ghost" onclick={() => sync.discard(item.seq)}>Descartar</button>
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
    padding: 0.3rem 0.3rem 0.3rem 0.75rem;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    font-size: var(--t-sm);
    color: var(--text);
  }
  .msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--ember);
  }
  .msg span {
    color: var(--text);
  }
  .banner.warn .msg {
    color: var(--muted);
  }
  .banner.err .msg {
    color: var(--danger);
  }
  .actions {
    display: flex;
    gap: 0.25rem;
  }
  button {
    min-height: 40px;
    padding: 0.3rem 0.75rem;
    font-size: var(--t-sm);
  }
</style>
