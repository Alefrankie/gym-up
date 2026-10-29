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
      const res = await cachedGet('/groups', groupListResponseSchema);
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
    <p class="muted">Cargando…</p>
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
              <Icon name="users" size={22} />
              <span class="grow">
                <strong>{g.name}</strong>
                <span class="muted">{g.memberCount} {g.memberCount === 1 ? 'miembro' : 'miembros'}</span>
              </span>
              <Icon name="right" size={20} />
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
  .intro p {
    margin: 0;
  }
  .code {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.4rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    text-align: center;
  }
</style>
