<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { muscle } from '#lib/labels';
  import { REST_SECONDS } from '#lib/offline/rest.svelte';
  import { useWorkoutView } from '#lib/offline/workout-context';
  import { toDisplay } from '#lib/offline/workout-view.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import MuscleFigure from '#lib/components/MuscleFigure.svelte';
  import SetTypeCell from '#lib/components/SetTypeCell.svelte';

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
    <a class="round back-btn" href={`/workout/${id}`} aria-label="Volver a la rutina"><Icon name="left" size={20} /></a>
    {#if view.elapsed}
      <span class="elapsed" role="timer" aria-label="Tiempo de entrenamiento"><Icon name="timer" size={14} />{view.elapsed}</span>
    {/if}
    <div class="figs">
      <MuscleFigure primary={ex.muscleGroup} secondary={ex.secondaryMuscles ?? []} view="both" size={60} />
    </div>
    <div class="title">
      <span class="count">Ejercicio {index + 1} de {exercises.length}</span>
      <h1>{ex.exerciseName}</h1>
    </div>
  </section>

  <div class="pills">
    <span class="chip"><Icon name="timer" size={14} />{mmss(ex.restSeconds ?? REST_SECONDS)}</span>
    <span class="chip">{muscle(ex.muscleGroup)}</span>
    {#if ex.last}
      <span class="chip on"><Icon name="history" size={14} />{ago(ex.last.date)}: {toDisplay(ex.last.weight, view.unit)} {view.unit} × {ex.last.reps}</span>
    {:else}
      <span class="chip">Primera vez</span>
    {/if}
    <a class="chip link" href={`/library/${ex.exerciseId}`}><Icon name="book" size={14} />Cómo se hace</a>
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
          <SetTypeCell {n} type={r.type} disabled={view.isCompleted} onpick={(type) => view.retype(ex.exerciseId, n, type)} />
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
          ><Icon name="check" size={18} /></button>
        </div>
      {/if}
    {/each}
    {#if !view.isCompleted}
      <button type="button" class="addset" onclick={() => view.addSet(ex)}><Icon name="plus" size={16} /> Añadir serie</button>
    {/if}
  </div>

  <div class="cta">
    <div class="pair">
      <button type="button" class="round" disabled={index === 0} onclick={() => go(-1)} aria-label="Ejercicio anterior"><Icon name="left" size={20} /></button>
      {#if isLast}
        <button class="primary" disabled={view.finishing || !view.anyCompleted || view.isCompleted} onclick={() => view.finish()}>
          {view.finishing ? 'Finalizando…' : 'Finalizar entrenamiento'}
        </button>
      {:else}
        <button class="primary" onclick={() => go(1)}>Siguiente ejercicio <Icon name="right" size={16} /></button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .hero {
    position: relative;
    margin: -0.5rem -1rem 0;
    padding: calc(env(safe-area-inset-top) + 3.25rem) 1rem 0.9rem;
    background: var(--surface);
    box-shadow: 0 1px 0 var(--line);
  }
  .round {
    display: grid;
    place-items: center;
    width: 40px;
    min-height: 40px;
    height: 40px;
    padding: 0;
    border-radius: 50%;
    color: var(--text);
  }
  a.round {
    background: var(--surface-hi);
    box-shadow: var(--shadow-card);
  }
  .back-btn {
    position: absolute;
    top: calc(env(safe-area-inset-top) + 0.5rem);
    left: 1rem;
  }
  .elapsed {
    position: absolute;
    top: calc(env(safe-area-inset-top) + 0.5rem + 6px);
    right: 1rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 28px;
    padding: 0 0.6rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-hi);
    font-size: var(--t-sm);
    font-weight: 600;
  }
  .figs {
    display: flex;
    justify-content: center;
    height: 6rem;
    overflow: hidden;
  }
  .title {
    margin-top: 0.5rem;
  }
  .count {
    color: var(--muted);
    font-size: var(--t-xs);
    font-weight: 500;
  }
  .title h1 {
    margin: 0.1rem 0 0;
    font-size: var(--t-lg);
  }
  .pills {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    margin: 0 -1rem;
    padding: 0.75rem 1rem 0;
    scrollbar-width: none;
  }
  .pills::-webkit-scrollbar {
    display: none;
  }
  .pills .chip {
    flex: none;
  }
  .pills .link {
    color: var(--text);
    text-decoration: none;
  }
  .table {
    display: grid;
    gap: 0.5rem;
  }
  .heads,
  .set {
    display: grid;
    grid-template-columns: 48px 1fr 1fr 48px;
    gap: 0.5rem;
    align-items: center;
  }
  .heads {
    color: var(--faint);
    font-size: var(--t-xs);
    font-weight: 500;
    text-align: center;
  }
  .set input {
    min-height: 48px;
    padding: 0 0.5rem;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--t-lg);
  }
  .set.active input {
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .set.done input {
    box-shadow: 0 0 0 1px var(--ok) inset;
    color: var(--ok);
  }
  .check {
    display: grid;
    place-items: center;
    width: 48px;
    min-height: 48px;
    height: 48px;
    padding: 0;
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--faint);
  }
  .set.done .check {
    background: var(--ok);
    box-shadow: none;
    color: #12220a;
  }
  .addset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 42px;
    background: none;
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--muted);
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, transparent, var(--bg) 45%);
    pointer-events: none;
  }
  .pair {
    display: flex;
    gap: 0.5rem;
    max-width: 22rem;
    margin: 0 auto;
    pointer-events: auto;
  }
  .pair .round {
    flex: none;
    background: var(--surface-hi);
    box-shadow: var(--shadow-card);
    width: 48px;
    height: 48px;
    min-height: 48px;
  }
  .pair .primary {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    margin-top: 0;
    min-height: 48px;
  }
</style>
