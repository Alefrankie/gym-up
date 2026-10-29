<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { PROGRAM_LIMITS, programDetailDtoSchema, type ProgramDetailDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
  import { startRoutine } from '#lib/offline/start-workout';
  import { saveBody } from '#lib/programs';
  import { session } from '#lib/session';
  import Icon from '#lib/components/Icon.svelte';
  import SortableRows from '#lib/components/SortableRows.svelte';
  import UndoToast from '#lib/components/UndoToast.svelte';

  type RoutineDto = ProgramDetailDto['routines'][number];

  const id = $derived(page.params.id ?? '');
  let program = $state<ProgramDetailDto | null>(null);
  let name = $state('');
  let routines = $state<RoutineDto[]>([]);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let dirty = $state(false);
  let saved = $state(false);
  let removed = $state<{ item: RoutineDto; index: number } | null>(null);

  const editable = $derived(!!program && !program.isTemplate);

  onMount(async () => {
    if (!(await session.require())) return;
    try {
      const res = await cachedGet(`/programs/${id}`, programDetailDtoSchema, {
        onCached: (c) => {
          program = c.data;
          name = c.data.name;
          routines = [...c.data.routines];
        },
      });
      program = res.data;
      name = program.name;
      routines = [...program.routines];
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión y este programa no está guardado.'
          : e instanceof ApiRequestError && e.status === 404
            ? 'Programa no encontrado'
            : 'No se pudo cargar el programa';
    }
  });

  const touch = () => {
    dirty = true;
    saved = false;
  };

  function remove(item: RoutineDto) {
    const index = routines.findIndex((r) => r.id === item.id);
    if (index < 0) return;
    routines.splice(index, 1);
    removed = { item, index };
    touch();
  }

  function undo() {
    if (!removed) return;
    routines.splice(removed.index, 0, removed.item);
    removed = null;
    touch();
  }

  async function persist(): Promise<boolean> {
    if (!program) return false;
    busy = true;
    error = null;
    try {
      program = await api(`/programs/${id}`, {
        method: 'PUT',
        body: saveBody(program, { name: name.trim() || program.name, routines }),
        schema: programDetailDtoSchema,
      });
      routines = [...program.routines];
      await invalidateCache(['/programs', '/workouts/today']);
      dirty = false;
      saved = true;
      busy = false;
      return true;
    } catch (e) {
      error =
        e instanceof NetworkError
          ? 'Sin conexión: conéctate para guardar el programa.'
          : e instanceof ApiRequestError
            ? e.message
            : 'No se pudo guardar';
      busy = false;
      return false;
    }
  }

  let starting = $state<string | null>(null);

  /** Starts a routine on any day, whatever the rotation says; opens its first exercise. */
  async function start(r: RoutineDto) {
    if (r.exercises.length === 0) {
      error = 'Esta rutina no tiene ejercicios todavía. Añádelos para poder empezarla.';
      return;
    }
    starting = r.id;
    error = null;
    try {
      const out = await startRoutine(r.id, (name) => confirm(`Tienes "${name}" en curso. ¿Cancelarlo y empezar "${r.name}"?`));
      if (out.kind === 'started') {
        await goto(out.firstExerciseId ? `/workout/${out.workoutId}/${out.firstExerciseId}` : `/workout/${out.workoutId}`);
        return;
      }
      if (out.kind === 'missing') error = 'No se pudo cargar la rutina';
    } catch (e) {
      error = e instanceof NetworkError ? 'Necesitas conexión para empezar una rutina nueva.' : e instanceof ApiRequestError ? e.message : 'No se pudo empezar la rutina';
    }
    starting = null;
  }

  /** A new routine is saved right away so its editor can load it from the server. */
  async function addRoutine() {
    if (!program || routines.length >= PROGRAM_LIMITS.routines) return;
    const fresh: RoutineDto = {
      id: crypto.randomUUID(),
      dayNumber: routines.length + 1,
      name: `Rutina ${routines.length + 1}`,
      focus: '',
      notes: null,
      exercises: [],
    };
    routines.push(fresh);
    if (await persist()) await goto(`/programs/${id}/${fresh.id}`);
    else routines.pop();
  }

  async function adopt() {
    busy = true;
    try {
      const copy = await api<ProgramDetailDto>(`/programs/${id}/adopt`, { method: 'POST', schema: programDetailDtoSchema });
      await invalidateCache(['/programs', '/workouts/today']);
      await goto(`/programs/${copy.id}`);
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'Necesitas conexión para usar esta plantilla';
      busy = false;
    }
  }

  async function archive() {
    if (!confirm('¿Archivar este programa? Tu historial no se borra.')) return;
    busy = true;
    try {
      await api(`/programs/${id}`, { method: 'DELETE' });
      await invalidateCache(['/programs', '/workouts/today']);
      await goto('/programs');
    } catch (e) {
      error = e instanceof ApiRequestError ? e.message : 'No se pudo archivar';
      busy = false;
    }
  }
</script>

<main>
  <p><a class="back" href="/programs"><Icon name="left" size={16} /> Entrenar</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !program && !error}
    <p class="muted loading">Cargando…</p>
  {:else if program}
    {#if editable}
      <input class="title" maxlength="60" aria-label="Nombre del programa" placeholder="Nombre del programa" bind:value={name} oninput={touch} />
    {:else}
      <h1>{program.name}</h1>
      {#if program.description}<p class="muted">{program.description}</p>{/if}
      <button class="primary use" disabled={busy} onclick={adopt}>Usar este programa</button>
    {/if}

    <div class="head">
      <h2>{routines.length} {routines.length === 1 ? 'rutina' : 'rutinas'}</h2>
      {#if editable}
        <button class="icon add" onclick={addRoutine} disabled={busy || routines.length >= PROGRAM_LIMITS.routines} aria-label="Añadir rutina">
          <Icon name="plus" size={18} />
        </button>
      {/if}
    </div>

    {#if routines.length === 0}
      <section class="card empty">
        <p>Este programa aún no tiene rutinas.</p>
        {#if editable}<button class="primary" onclick={addRoutine}>Crear la primera rutina</button>{/if}
      </section>
    {:else}
      <SortableRows
        items={routines}
        key={(r) => r.id}
        disabled={!editable}
        onreorder={(next) => {
          routines = next;
          touch();
        }}
        onremove={editable ? remove : undefined}
      >
        {#snippet row(r, i)}
          <div class="routine">
            <a class="open" href={`/programs/${id}/${r.id}`}>
              <span class="num">{i + 1}</span>
              <span class="grow">
                <strong>{r.name}</strong>
                <span class="muted">{r.focus || 'Sin enfoque'} · {r.exercises.length} {r.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
              </span>
            </a>
            {#if editable}
              <button type="button" data-nodrag class="start" disabled={starting !== null} onclick={() => start(r)} aria-label={`Empezar ${r.name}`}>
                <Icon name="bolt" size={14} /> {starting === r.id ? '…' : 'Empezar'}
              </button>
            {:else}
              <Icon name="right" size={18} />
            {/if}
          </div>
        {/snippet}
      </SortableRows>
      {#if editable}
        <p class="hint muted">Toca "Empezar" para entrenar esa rutina hoy, sea cual sea su día · mantén pulsada para moverla · desliza a la derecha para eliminarla</p>
      {/if}
    {/if}

    {#if editable}
      <p class="archive"><button class="danger" disabled={busy} onclick={archive}><Icon name="trash" size={16} /> Archivar programa</button></p>
    {/if}

    {#if editable && (dirty || saved)}
      <div class="savebar">
        {#if saved}<span class="ok"><Icon name="check" size={16} /> Guardado</span>{/if}
        {#if dirty}<button class="primary" disabled={busy || !name.trim()} onclick={persist}>Guardar cambios</button>{/if}
      </div>
    {/if}
  {/if}
</main>

{#if removed}
  <UndoToast message={`${removed.item.name} eliminada`} onundo={undo} ondismiss={() => (removed = null)} />
{/if}

<style>
  .title {
    width: 100%;
    margin-top: 0.25rem;
    min-height: 48px;
    font-weight: 600;
    font-size: var(--t-xl);
    letter-spacing: -0.015em;
  }
  .use {
    margin-bottom: 0.5rem;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .head h2 {
    margin: 1.25rem 0 0.5rem;
  }
  .add {
    width: 36px;
    min-height: 36px;
    border-radius: 50%;
    color: var(--accent);
  }
  .routine {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.5rem 0.4rem 0.75rem;
    min-height: 56px;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
    color: var(--text);
    text-decoration: none;
  }
  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-height: 44px;
    color: var(--text);
    text-decoration: none;
  }
  .start {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 34px;
    padding: 0 0.7rem;
    border-radius: var(--radius-sm);
    color: var(--accent-hi);
    font-size: var(--t-sm);
    font-weight: 550;
  }
  .num {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--surface-hi);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.1rem;
  }
  .grow strong {
    font-size: var(--t-md);
    font-weight: 550;
  }
  .grow .muted {
    font-size: var(--t-sm);
  }
  .hint {
    margin: 0.75rem 0 0;
    font-size: var(--t-xs);
    text-align: center;
  }
  .empty {
    text-align: center;
  }
  .archive {
    margin-top: 1.5rem;
  }
  .archive button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--t-sm);
  }
  .savebar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1.25rem 1rem calc(0.9rem + env(safe-area-inset-bottom));
    display: grid;
    gap: 0.4rem;
    justify-items: center;
    background: linear-gradient(180deg, transparent, var(--bg) 60%);
    pointer-events: none;
  }
  .savebar > * {
    pointer-events: auto;
  }
  .savebar .ok {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--t-sm);
  }
  .savebar .primary {
    max-width: 22rem;
    min-height: 44px;
    margin-top: 0;
  }
</style>
