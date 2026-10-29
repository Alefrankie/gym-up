<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { groupListResponseSchema, groupSummarySchema, type GroupSummaryDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';

  let groups = $state<GroupSummaryDto[] | null>(null);
  let stale = $state(false);
  let error = $state<string | null>(null);
  let formError = $state<string | null>(null);
  let busy = $state(false);
  let newName = $state('');
  let code = $state('');

  async function load() {
    try {
      const res = await cachedGet('/groups', groupListResponseSchema, { onCached: (c) => (groups = c.data.items) });
      groups = res.data.items;
      stale = res.stale;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y todavía no hay grupos guardados.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudieron cargar los grupos';
    }
  }

  onMount(async () => {
    if (await session.require()) await load();
  });

  async function submit(path: string, body: unknown) {
    busy = true;
    formError = null;
    try {
      const g = await api(path, { method: 'POST', body, schema: groupSummarySchema });
      await invalidateCache(['/groups']);
      await goto(`/groups/${g.id}`);
    } catch (e) {
      formError =
        e instanceof NetworkError
          ? 'Necesitas conexión para esto.'
          : e instanceof ApiRequestError
            ? e.status === 404
              ? 'No existe ningún grupo con ese código.'
              : e.message
            : 'No se pudo completar';
      busy = false;
    }
  }
</script>

<main>
  <h1>Grupos</h1>
  <SyncBanner />
  {#if stale}<p class="muted">Sin conexión: mostrando los últimos grupos descargados.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if !groups && !error}
    <p class="muted loading">Cargando…</p>
  {:else if groups}
    {#if groups.length === 0}
      <section class="card hero intro">
        <h2>Entrena acompañado</h2>
        <p class="muted">
          Crea un grupo y comparte su código con tus amigos, o únete con el código que te den. Solo los miembros del grupo
          ven las rachas y los entrenamientos de los demás.
        </p>
      </section>
    {:else}
      <ul class="list">
        {#each groups as g (g.id)}
          <li>
            <a href={`/groups/${g.id}`}>
              <span class="tile"><Icon name="users" size={18} /></span>
              <span class="grow">
                <strong>{g.name}</strong>
                <span class="muted">{g.memberCount} {g.memberCount === 1 ? 'miembro' : 'miembros'}</span>
              </span>
              <span class="chev"><Icon name="right" size={16} /></span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}

    <section class="card">
      <h3>Crear un grupo</h3>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          void submit('/groups', { id: crypto.randomUUID(), name: newName });
        }}
      >
        <label>
          Nombre
          <input required minlength="2" maxlength="40" placeholder="Los del gym" bind:value={newName} />
        </label>
        <button class="primary" disabled={busy}>Crear grupo</button>
      </form>
    </section>

    <section class="card">
      <h3>Unirme con un código</h3>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          void submit('/groups/join', { code });
        }}
      >
        <label>
          Código de 6 caracteres
          <input
            required
            minlength="6"
            maxlength="6"
            autocapitalize="characters"
            autocomplete="off"
            class="code"
            placeholder="K7M2QX"
            bind:value={code}
          />
        </label>
        <button class="primary" disabled={busy}>Unirme</button>
      </form>
    </section>
    {#if formError}<p class="error" role="alert">{formError}</p>{/if}
  {/if}
</main>

<AppNav />

<style>
  .intro h2 {
    margin: 0 0 0.35rem;
  }
  .intro p {
    margin: 0;
    font-size: var(--t-sm);
  }
  .tile {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    color: var(--muted);
  }
  .chev {
    display: grid;
    color: var(--faint);
  }
  section.card h3 {
    margin-bottom: 0.6rem;
  }
  /* Join codes are entered as capitals; the transform keeps typing feedback honest. */
  .code {
    font-size: var(--t-md);
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: center;
  }
</style>
