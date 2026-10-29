<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { photoListResponseSchema, type PhotoDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { deleteRequest, fetchBlob, uploadBlob } from '#lib/api/binary';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { compressImage } from '#lib/image';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';

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
      photos = (await cachedGet('/photos', photoListResponseSchema, { onCached: (c) => (photos = c.data) })).data;
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
  <p><a class="back" href="/more"><Icon name="left" size={18} /> Más</a></p>
  <h1>Fotos de progreso</h1>
  <p class="privacy muted"><Icon name="key" size={16} /> Solo tú las ves. No aparecen en la vista de familia.</p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <div class="actions">
    <label class="cta" class:disabled={busy}>
      <Icon name="camera" size={18} />
      {busy ? 'Subiendo…' : 'Tomar foto'}
      <input type="file" accept="image/*" capture="environment" onchange={pick} disabled={busy} hidden />
    </label>
    <label class="cta secondary" class:disabled={busy}>
      <Icon name="plus" size={18} />
      Elegir de la galería
      <input type="file" accept="image/*" onchange={pick} disabled={busy} hidden />
    </label>
  </div>

  {#if !photos && !error}
    <p class="muted loading">Cargando…</p>
  {:else if photos && photos.length === 0}
    <section class="card empty">
      <Icon name="camera" size={20} />
      <p class="muted">Todavía no hay fotos. Sube la primera para ver tu cambio con el tiempo.</p>
    </section>
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
        <button type="button" onclick={() => (viewing = null)}><Icon name="x" size={16} /> Cerrar</button>
        <button type="button" class="danger" onclick={() => viewing && remove(viewing)}><Icon name="trash" size={16} /> Borrar</button>
      </div>
    </div>
  {/if}
</main>

<AppNav />

<style>
  .privacy {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--t-sm);
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin: 0.75rem 0 1.25rem;
  }
  .actions > * {
    flex: 1;
  }
  .cta {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: var(--control);
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: var(--t-base);
    font-weight: 600;
    text-align: center;
    cursor: pointer;
  }
  .cta.secondary {
    background: var(--surface-hi);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--text);
    font-weight: 550;
  }
  .cta.disabled {
    opacity: 0.45;
    cursor: default;
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    text-align: center;
    padding: 1.5rem 0.9rem;
    color: var(--muted);
  }
  .empty p {
    margin: 0;
    font-size: var(--t-sm);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.4rem;
  }
  .thumb {
    position: relative;
    aspect-ratio: 3 / 4;
    min-height: 44px;
    padding: 0;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  /* Date label sits on a small solid chip so it reads on any photo. */
  .date {
    position: absolute;
    left: 0.3rem;
    bottom: 0.3rem;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    background: rgb(14 14 16 / 0.78);
    color: var(--text);
    font-size: var(--t-xs);
    font-weight: 500;
  }
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    align-content: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgb(14 14 16 / 0.96);
    text-align: center;
  }
  .overlay p {
    margin: 0;
    color: var(--muted);
    font-size: var(--t-sm);
  }
  .overlay .actions {
    margin: 0;
  }
  .overlay img {
    max-width: 100%;
    max-height: 70vh;
    margin: 0 auto;
    border-radius: var(--radius);
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
  }
  .thumb {
    display: block;
  }
</style>
