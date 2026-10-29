<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { photoListResponseSchema, type PhotoDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { deleteRequest, fetchBlob, uploadBlob } from '#lib/api/binary';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { compressImage } from '#lib/image';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';

  let photos = $state<PhotoDto[] | null>(null);
  let urls = $state<Record<string, string>>({});
  let error = $state<string | null>(null);
  let busy = $state(false);
  let viewing = $state<PhotoDto | null>(null);

  function describe(e: unknown, fallback: string): string {
    if (e instanceof NetworkError) return 'Las fotos necesitan conexión a internet.';
    if (e instanceof ApiRequestError) {
      return e.status === 503 ? 'Las fotos todavía no están activadas en el servidor.' : e.message;
    }
    return fallback;
  }

  async function load() {
    try {
      photos = (await cachedGet('/photos', photoListResponseSchema)).data;
      // Thumbnails are fetched one by one with the bearer token and shown through object URLs.
      for (const p of photos) {
        if (urls[p.id]) continue;
        try {
          urls[p.id] = URL.createObjectURL(await fetchBlob(`/photos/${p.id}/file`));
        } catch {
          /* a missing thumbnail must not hide the others */
        }
      }
    } catch (e) {
      error = describe(e, 'No se pudieron cargar las fotos');
    }
  }

  onMount(async () => {
    if (await session.require()) await load();
  });

  onDestroy(() => Object.values(urls).forEach((u) => URL.revokeObjectURL(u)));

  async function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    busy = true;
    error = null;
    try {
      const blob = await compressImage(file);
      await uploadBlob(`/photos/${crypto.randomUUID()}`, blob);
      await invalidateCache(['/photos']);
      await load();
    } catch (e) {
      error = describe(e, 'No se pudo subir la foto');
    } finally {
      busy = false;
    }
  }

  async function remove(p: PhotoDto) {
    if (!confirm('¿Borrar esta foto? No se puede deshacer.')) return;
    try {
      await deleteRequest(`/photos/${p.id}`);
      URL.revokeObjectURL(urls[p.id] ?? '');
      delete urls[p.id];
      viewing = null;
      await invalidateCache(['/photos']);
      await load();
    } catch (e) {
      error = describe(e, 'No se pudo borrar la foto');
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<main>
  <h1>Fotos de progreso</h1>
  <p class="muted">Solo tú puedes verlas. No aparecen en la vista de familia.</p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="actions">
    <label class="button">
      {busy ? 'Subiendo…' : 'Tomar foto'}
      <input type="file" accept="image/*" capture="environment" onchange={pick} disabled={busy} hidden />
    </label>
    <label class="button secondary">
      Elegir de la galería
      <input type="file" accept="image/*" onchange={pick} disabled={busy} hidden />
    </label>
  </div>

  {#if !photos && !error}
    <p class="muted">Cargando…</p>
  {:else if photos && photos.length === 0}
    <p class="muted">Todavía no hay fotos.</p>
  {:else if photos}
    <div class="grid">
      {#each photos as p (p.id)}
        <button type="button" class="thumb" onclick={() => (viewing = p)} aria-label={`Foto del ${fmt(p.photoDate)}`}>
          {#if urls[p.id]}<img src={urls[p.id]} alt={p.caption ?? 'Foto de progreso'} />{:else}<span class="muted">…</span>{/if}
          <span class="date">{fmt(p.photoDate)}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if viewing}
    <div class="overlay" role="dialog" aria-modal="true">
      {#if urls[viewing.id]}<img src={urls[viewing.id]} alt={viewing.caption ?? 'Foto de progreso'} />{/if}
      <p>{fmt(viewing.photoDate)}{viewing.caption ? ` · ${viewing.caption}` : ''}</p>
      <div class="actions">
        <button type="button" onclick={() => (viewing = null)}>Cerrar</button>
        <button type="button" class="danger" onclick={() => viewing && remove(viewing)}>Borrar</button>
      </div>
    </div>
  {/if}
</main>

<AppNav />

<style>
  .actions {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0;
  }
  .button {
    flex: 1;
    text-align: center;
    padding: 0.75rem;
    border-radius: 0.5rem;
    background: var(--accent);
    color: #052e16;
    font-weight: 600;
  }
  .button.secondary {
    background: var(--surface);
    color: var(--text);
    border: 1px solid #334155;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }
  .thumb {
    position: relative;
    aspect-ratio: 3 / 4;
    padding: 0;
    overflow: hidden;
    background: var(--surface);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .date {
    position: absolute;
    inset: auto 0 0 0;
    padding: 0.2rem;
    font-size: 0.7rem;
    background: #000a;
  }
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    align-content: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #020617f2;
    text-align: center;
  }
  .overlay img {
    max-width: 100%;
    max-height: 70vh;
    margin: 0 auto;
    border-radius: 0.5rem;
  }
  .danger {
    border-color: var(--danger);
    color: var(--danger);
  }
</style>
