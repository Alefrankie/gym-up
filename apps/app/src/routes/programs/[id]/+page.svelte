<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { PROGRAM_LIMITS, programDetailDtoSchema, type ProgramDetailDto } from '@gym-up/contracts';
  import { api, ApiRequestError, NetworkError } from '#lib/api/client';
  import { cachedGet, invalidateCache } from '#lib/offline/cache';
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
      const res = await cachedGet(`/programs/${id}`, programDetailDtoSchema);
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
  <p><a class="back" href="/programs"><Icon name="left" size={18} /> Entrenar</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if !program && !error}
    <p class="muted">Cargando…</p>
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
          <Icon name="plus" size={22} />
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
          <a class="routine" href={`/programs/${id}/${r.id}`}>
            <span class="num">{i + 1}</span>
            <span class="grow">
              <strong>{r.name}</strong>
              <span class="muted">{r.focus || 'Sin enfoque'} · {r.exercises.length} {r.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
            </span>
            <Icon name="right" size={20} />
          </a>
        {/snippet}
      </SortableRows>
      {#if editable}
        <p class="hint muted">Mantén pulsada una rutina para moverla · desliza a la derecha para eliminarla</p>
      {/if}
    {/if}

    {#if editable}
      <p class="archive"><button class="danger" disabled={busy} onclick={archive}><Icon name="trash" size={18} /> Archivar programa</button></p>
    {/if}

    {#if editable && (dirty || saved)}
      <div class="savebar">
        {#if saved}<span class="ok"><Icon name="check" size={18} /> Guardado</span>{/if}
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
    margin-top: 0.4rem;
    min-height: 56px;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.7rem;
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
    margin: 1.4rem 0 0.6rem;
  }
  .add {
    border-radius: 50%;
    background: linear-gradient(180deg, var(--accent-hi), var(--accent));
    box-shadow: var(--shadow-accent);
    color: var(--accent-ink);
  }
  .routine {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 0.8rem 0.9rem;
    min-height: 4.4rem;
    border-radius: var(--radius);
    background: linear-gradient(180deg, var(--surface-hi), var(--surface));
    box-shadow: var(--shadow-card);
    color: var(--text);
    text-decoration: none;
  }
  .num {
    flex: none;
    display: grid;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    background: linear-gradient(180deg, var(--accent-hi), var(--accent));
    color: var(--accent-ink);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.3rem;
  }
  .grow {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.2rem;
  }
  .grow strong {
    font-size: 1.15rem;
    font-weight: 600;
  }
  .hint {
    margin: 0.8rem 0 0;
    font-size: 0.85rem;
    text-align: center;
  }
  .empty {
    text-align: center;
  }
  .archive {
    margin-top: 2rem;
  }
  .savebar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1.4rem 1rem calc(1rem + env(safe-area-inset-bottom));
    display: grid;
    gap: 0.4rem;
    justify-items: center;
    background: linear-gradient(180deg, transparent, var(--bg) 55%);
    pointer-events: none;
  }
  .savebar > * {
    pointer-events: auto;
  }
  .savebar .primary {
    max-width: 22rem;
    margin-top: 0;
    border-radius: 999px;
  }
</style>
