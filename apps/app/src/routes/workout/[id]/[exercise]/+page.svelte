<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { muscle } from '#lib/labels';
  import { REST_SECONDS } from '#lib/offline/rest.svelte';
  import { useWorkoutView } from '#lib/offline/workout-context';
  import { toDisplay } from '#lib/offline/workout-view.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';

  const view = useWorkoutView();
  const id = $derived(page.params.id ?? '');
  const exercises = $derived(view.snap?.exercises ?? []);
  const index = $derived(exercises.findIndex((e) => e.exerciseId === page.params.exercise));
  const ex = $derived(index >= 0 ? exercises[index]! : null);
  const isLast = $derived(index === exercises.length - 1);
  const active = $derived(ex ? view.activeSet(ex) : null);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const ago = (iso: string) => {
    const days = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));
    return days === 0 ? 'Hoy' : days === 1 ? 'Ayer' : `Hace ${days} días`;
  };

  function go(delta: number) {
    const next = exercises[index + delta];
    if (next) void goto(`/workout/${id}/${next.exerciseId}`, { replaceState: true });
    else void goto(`/workout/${id}`);
  }
</script>

{#if !ex}
  <p class="muted">Este ejercicio no está en el entrenamiento.</p>
  <p><a class="back" href={`/workout/${id}`}><Icon name="left" size={18} /> Volver a la rutina</a></p>
{:else}
  <section class="hero" aria-label={ex.exerciseName}>
    <a class="round back-btn" href={`/workout/${id}`} aria-label="Volver a la rutina"><Icon name="left" size={22} /></a>
    {#if view.elapsed}
      <span class="elapsed" role="timer" aria-label="Tiempo de entrenamiento"><Icon name="timer" size={18} />{view.elapsed}</span>
    {/if}
    <div class="figs">
      <MuscleFigure primary={ex.muscleGroup} secondary={ex.secondaryMuscles ?? []} view="both" size={72} />
    </div>
    <div class="title">
      <span class="count">Ejercicio {index + 1} de {exercises.length}</span>
      <h1>{ex.exerciseName}</h1>
    </div>
  </section>

  <div class="pills" role="list">
    <span class="chip" role="listitem"><Icon name="timer" size={18} />{mmss(ex.restSeconds ?? REST_SECONDS)}</span>
    <span class="chip" role="listitem">{muscle(ex.muscleGroup)}</span>
    {#if ex.last}
      <span class="chip on" role="listitem"><Icon name="history" size={18} />{ago(ex.last.date)}: {toDisplay(ex.last.weight, view.unit)} {view.unit} × {ex.last.reps}</span>
    {:else}
      <span class="chip" role="listitem">Primera vez</span>
    {/if}
    <a class="chip link" role="listitem" href={`/library/${ex.exerciseId}`}><Icon name="book" size={18} />Cómo se hace</a>
  </div>

  <h2>Series</h2>
  <div class="table" role="group" aria-label="Series">
    <div class="heads">
      <span>Serie</span>
      <span>Reps</span>
      <span>{view.unit.toUpperCase()}</span>
      <span></span>
    </div>
    {#each view.setNumbers(ex) as n (n)}
      {@const r = view.row(ex.exerciseId, n)}
      {#if r}
        <div class="set" class:done={r.completed} class:active={active === n}>
          <span class="n">{n}</span>
          <input
            type="number"
            inputmode="numeric"
            min="1"
            max="100"
            bind:value={r.reps}
            disabled={view.isCompleted}
            onchange={() => view.edited(ex.exerciseId, n)}
            aria-label={`Serie ${n}: repeticiones`}
          />
          <input
            type="number"
            inputmode="decimal"
            min="0"
            step="0.5"
            bind:value={r.weight}
            disabled={view.isCompleted}
            onchange={() => view.edited(ex.exerciseId, n)}
            aria-label={`Serie ${n}: peso (${view.unit})`}
          />
          <button
            type="button"
            class="check"
            disabled={view.isCompleted}
            onclick={() => view.commit(ex.exerciseId, n, !r.completed)}
            aria-label={r.completed ? `Desmarcar serie ${n}` : `Completar serie ${n}`}
          ><Icon name="check" size={22} /></button>
        </div>
      {/if}
    {/each}
    {#if !view.isCompleted}
      <button type="button" class="addset" onclick={() => view.addSet(ex)}><Icon name="plus" size={18} /> Añadir serie</button>
    {/if}
  </div>

  <div class="cta">
    <div class="pair">
      <button type="button" class="round" disabled={index === 0} onclick={() => go(-1)} aria-label="Ejercicio anterior"><Icon name="left" size={22} /></button>
      {#if isLast}
        <button class="primary" disabled={view.finishing || !view.anyCompleted || view.isCompleted} onclick={() => view.finish()}>
          {view.finishing ? 'Finalizando…' : 'Finalizar entrenamiento'}
        </button>
      {:else}
        <button class="primary" onclick={() => go(1)}>Siguiente ejercicio <Icon name="right" size={20} /></button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .hero {
    position: relative;
    margin: -0.5rem -1rem 0;
    padding: calc(env(safe-area-inset-top) + 3.6rem) 1rem 1.1rem;
    background:
      radial-gradient(70% 90% at 50% 30%, rgb(255 106 43 / 0.28), transparent 70%),
      linear-gradient(180deg, var(--surface-hi), var(--bg));
  }
  .round {
    display: grid;
    place-items: center;
    width: 2.75rem;
    min-height: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border-radius: 50%;
    color: var(--text);
  }
  a.round {
    background: linear-gradient(180deg, var(--raised), var(--surface-hi));
    box-shadow: var(--shadow-card);
  }
  .back-btn {
    position: absolute;
    top: calc(env(safe-area-inset-top) + 0.6rem);
    left: 1rem;
  }
  .elapsed {
    position: absolute;
    top: calc(env(safe-area-inset-top) + 0.7rem);
    right: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-hi);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.15rem;
  }
  .figs {
    display: flex;
    justify-content: center;
    height: 9.4rem;
    overflow: hidden;
  }
  .title {
    margin-top: 0.4rem;
  }
  .count {
    color: var(--muted);
    font-size: 0.85rem;
    font-weight: 500;
  }
  .title h1 {
    margin: 0.1rem 0 0;
    font-size: 2rem;
  }
  .pills {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    margin: 0.2rem -1rem 0;
    padding: 0.4rem 1rem 0.2rem;
    scrollbar-width: none;
  }
  .pills::-webkit-scrollbar {
    display: none;
  }
  .pills .chip {
    flex: none;
    min-height: 40px;
  }
  .pills .link {
    color: var(--text);
    text-decoration: none;
  }
  .table {
    display: grid;
    gap: 0.6rem;
  }
  .heads,
  .set {
    display: grid;
    grid-template-columns: 3.2rem 1fr 1fr 3.2rem;
    gap: 0.6rem;
    align-items: center;
  }
  .heads {
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
  }
  .n {
    display: grid;
    place-items: center;
    height: 3.4rem;
    border-radius: var(--radius-sm);
    background: linear-gradient(180deg, var(--surface-hi), var(--surface));
    box-shadow: var(--shadow-card);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.4rem;
  }
  .set input {
    min-height: 3.4rem;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.7rem;
  }
  .set.active input {
    box-shadow: 0 0 0 2px var(--accent) inset, 0 2px 4px rgb(0 0 0 / 0.35) inset;
  }
  .set.active .n {
    color: var(--accent-hi);
  }
  .set.done input {
    box-shadow: 0 0 0 1px var(--ok) inset;
    color: var(--ok);
  }
  .check {
    display: grid;
    place-items: center;
    width: 3.2rem;
    min-height: 3.4rem;
    height: 3.4rem;
    padding: 0;
    background: var(--bg);
    box-shadow: 0 0 0 1px var(--line) inset, 0 2px 4px rgb(0 0 0 / 0.35) inset;
    color: var(--muted);
  }
  .set.done .check {
    background: linear-gradient(180deg, #a9dc83, var(--ok));
    box-shadow: 0 1px 0 rgb(255 255 255 / 0.4) inset, 0 8px 16px -8px rgb(143 203 107 / 0.7);
    color: #12220a;
  }
  .addset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 3.4rem;
    background: none;
    box-shadow: none;
    border: 1.5px dashed var(--line);
    color: var(--muted);
  }
  .cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 1.5rem 1rem calc(1rem + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, transparent, var(--bg) 55%);
    pointer-events: none;
  }
  .pair {
    display: flex;
    gap: 0.6rem;
    max-width: 30rem;
    margin: 0 auto;
    pointer-events: auto;
  }
  .pair .round {
    flex: none;
    background: linear-gradient(180deg, var(--raised), var(--surface-hi));
    box-shadow: var(--shadow-card);
    width: 3.4rem;
    height: 3.4rem;
    min-height: 3.4rem;
  }
  .pair .primary {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0;
    min-height: 3.4rem;
    border-radius: 999px;
  }
</style>
