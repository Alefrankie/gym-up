<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { groupDetailSchema, type GroupDetailDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import Icon from '#lib/components/Icon.svelte';

  const id = $derived(page.params.id ?? '');
  let detail = $state<GroupDetailDto | null>(null);
  let error = $state<string | null>(null);
  let copied = $state(false);
  let busy = $state(false);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      detail = (await cachedGet(`/groups/${id}`, groupDetailSchema)).data;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y este grupo no está guardado.'
          : e instanceof ApiRequestError && e.status === 404
            ? 'Este grupo no existe o ya no eres miembro.'
            : 'No se pudo cargar el grupo';
    }
  });

  async function copy() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.group.code);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      /* clipboard can be unavailable in a WebView; the code is on screen anyway */
    }
  }

  async function leave() {
    if (!confirm('¿Salir de este grupo?')) return;
    busy = true;
    try {
      await api(`/groups/${id}/members/me`, { method: 'DELETE' });
      await invalidateCache(['/groups']);
      await goto('/groups');
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'Necesitas conexión para salir del grupo';
      busy = false;
    }
  }

  const fmt = (d: string | null) =>
    d ? new Date(d + 'T00:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'sin entrenar aún';
</script>

<main>
  <p><a class="back" href="/groups"><Icon name="left" size={18} /> Grupos</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !detail && !error}
    <p class="muted">Cargando…</p>
  {:else if detail}
    <h1>{detail.group.name}</h1>

    <section class="card hero invite">
      <span class="muted">Código para invitar</span>
      <strong class="code">{detail.group.code}</strong>
      <button onclick={copy}><Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Copiado' : 'Copiar código'}</button>
    </section>

    <h2>Miembros</h2>
    <ul class="list">
      {#each detail.members as m, i (m.id)}
        <li>
          <a href={`/groups/member/${m.id}`}>
            <span class="rank">{i + 1}</span>
            <Avatar name={m.displayName} />
            <span class="grow">
              <strong>{m.displayName}{m.id === session.user?.id ? ' (tú)' : ''}</strong>
              <span class="muted">{m.totalWorkouts} entrenamientos · último: {fmt(m.lastWorkout)}</span>
            </span>
            <span class="streak" class:on={m.currentStreak > 0}>
              <Icon name="flame" size={18} />{m.currentStreak}
            </span>
          </a>
        </li>
      {/each}
    </ul>

    <button class="danger" disabled={busy} onclick={leave}>Salir del grupo</button>
  {/if}
</main>

<AppNav />

<style>
  .invite {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    text-align: center;
  }
  .code {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 2.8rem;
    letter-spacing: 0.28em;
    padding-left: 0.28em;
    line-height: 1;
  }
  .rank {
    width: 1.2rem;
    text-align: center;
    color: var(--muted);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.2rem;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    color: var(--muted);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.3rem;
  }
  .streak.on {
    color: var(--ember);
  }
</style>
