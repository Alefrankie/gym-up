<script lang="ts">
  import { onMount } from 'svelte';
  import { familyResponseSchema, type MemberCardDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import SyncBanner from '#lib/components/SyncBanner.svelte';

  let members = $state<MemberCardDto[] | null>(null);
  let stale = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const res = await cachedGet('/family', familyResponseSchema);
      members = res.data;
      stale = res.stale;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y todavía no hay datos guardados.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudo cargar la familia';
    }
  });

  const fmt = (d: string | null) =>
    d ? new Date(d + 'T00:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'sin entrenamientos';
</script>

<main>
  <h1>Familia</h1>
  <SyncBanner />
  {#if stale}<p class="muted">Sin conexión: mostrando los últimos datos descargados.</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !members && !error}
    <p class="muted">Cargando…</p>
  {:else if members}
    <ul class="list">
      {#each members as m (m.id)}
        <li>
          <a href={`/family/${m.id}`}>
            <strong>{m.displayName}{m.id === session.user?.id ? ' (tú)' : ''}</strong>
            <span class="muted">
              {m.totalWorkouts} entrenamientos · racha {m.currentStreak} · último: {fmt(m.lastWorkout)}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<AppNav />
