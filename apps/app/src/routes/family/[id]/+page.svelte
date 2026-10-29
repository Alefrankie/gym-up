<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { memberProfileSchema, type MemberProfileDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';

  let member = $state<MemberProfileDto | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      member = (await cachedGet(`/family/${page.params.id}`, memberProfileSchema)).data;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y todavía no hay datos guardados.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudo cargar el perfil';
    }
  });

  const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
</script>

<main>
  <p><a href="/family">← Familia</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !member && !error}
    <p class="muted">Cargando…</p>
  {:else if member}
    <h1>{member.profile.displayName}</h1>
    <section class="card stats">
      <div><strong>{member.stats.totalWorkouts}</strong><span class="muted">entrenamientos</span></div>
      <div><strong>{member.stats.currentStreak}</strong><span class="muted">racha</span></div>
    </section>
    <h2>Entrenamientos</h2>
    {#if member.workouts.length === 0}
      <p class="muted">Todavía no ha terminado ninguno.</p>
    {:else}
      <ul class="list">
        {#each member.workouts as w (w.id)}
          <li>{fmt(w.workoutDate)}</li>
        {/each}
      </ul>
    {/if}
  {/if}
</main>

<AppNav />

<style>
  .stats {
    display: flex;
    justify-content: space-around;
    text-align: center;
  }
  .stats div {
    display: grid;
  }
  .stats strong {
    font-size: 1.75rem;
    color: var(--accent);
  }
</style>
