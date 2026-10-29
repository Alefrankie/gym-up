<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { memberProfileSchema, type MemberProfileDto } from '@gym-up/contracts';
  import { ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet } from '#lib/offline/cache';
  import { session } from '#lib/session';
  import AppNav from '#lib/components/AppNav.svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import Icon from '#lib/components/Icon.svelte';

  let member = $state<MemberProfileDto | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      member = (await cachedGet(`/groups/members/${page.params.id}`, memberProfileSchema)).data;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y todavía no hay datos guardados.'
          : e instanceof ApiRequestError && e.status === 404
            ? 'Solo puedes ver a quienes comparten un grupo contigo.'
            : 'No se pudo cargar el perfil';
    }
  });

  const fmt = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
</script>

<main>
  <p><button class="ghost back" onclick={() => history.back()}><Icon name="left" size={18} /> Volver</button></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !member && !error}
    <p class="muted">Cargando…</p>
  {:else if member}
    <header class="who">
      <Avatar name={member.profile.displayName} size={64} />
      <h1>{member.profile.displayName}</h1>
    </header>

    <section class="card hero stats">
      <div>
        <span class="big-number">{member.stats.totalWorkouts}</span>
        <span class="muted">entrenamientos</span>
      </div>
      <div>
        <span class="big-number streak"><Icon name="flame" size={28} />{member.stats.currentStreak}</span>
        <span class="muted">racha</span>
      </div>
    </section>

    <h2>Entrenamientos</h2>
    {#if member.workouts.length === 0}
      <p class="muted">Todavía no ha terminado ninguno.</p>
    {:else}
      <ul class="list">
        {#each member.workouts as w (w.id)}
          <li>
            <div class="row-body">
              <Icon name="check" size={20} />
              <span class="grow">{fmt(w.workoutDate)}</span>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</main>

<AppNav />

<style>
  .who {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  .who h1 {
    margin: 0.5rem 0;
  }
  .stats {
    display: flex;
    justify-content: space-around;
    text-align: center;
  }
  .stats div {
    display: grid;
    gap: 0.25rem;
  }
  .streak {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    color: var(--ember);
  }
  .back {
    padding-left: 0;
  }
</style>
