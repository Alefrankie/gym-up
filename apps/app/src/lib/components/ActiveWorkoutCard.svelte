<script lang="ts">
  import { onMount } from 'svelte';
  import { getActiveWorkoutId, loadSnapshot, type WorkoutSnapshot } from '#lib/offline/workout-session';
  import { cancelWorkoutById } from '#lib/offline/start-workout';
  import Icon from './Icon.svelte';
  import OverflowMenu from './OverflowMenu.svelte';

  /** The workout under way on this device, if any: what it is, how long it has run, and how to continue or drop it. */
  let { oncancelled }: { oncancelled?: () => void } = $props();

  let snap = $state<WorkoutSnapshot | null>(null);
  let now = $state(Date.now());
  let busy = $state(false);

  onMount(() => {
    void (async () => {
      const id = await getActiveWorkoutId();
      const s = id ? await loadSnapshot(id) : undefined;
      snap = s && s.status === 'in_progress' ? s : null;
    })();
    const t = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(t);
  });

  const done = $derived(snap ? Object.values(snap.rows).filter((r) => r.completed).length : 0);
  const total = $derived(snap ? snap.exercises.reduce((n, e) => n + e.targetSets, 0) : 0);
  const elapsed = $derived.by(() => {
    if (!snap) return '';
    const s = Math.max(0, Math.floor((now - snap.startedAt) / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  });

  async function cancel() {
    if (!snap || !confirm(`¿Cancelar "${snap.dayName}"? Se borra todo lo registrado en él.`)) return;
    busy = true;
    await cancelWorkoutById(snap.workoutId);
    snap = null;
    busy = false;
    oncancelled?.();
  }
</script>

{#if snap}
  <div class="wrap">
    <a class="live" href={`/workout/${snap.workoutId}`} aria-label={`Continuar ${snap.dayName}`}>
      <div class="top">
        <span class="dot" aria-hidden="true"></span>
        <span class="label">En curso</span>
        <span class="time" role="timer"><Icon name="timer" size={14} />{elapsed}</span>
      </div>
      <span class="row">
        <strong class="name">{snap.dayName}</strong>
        <Icon name="right" size={20} />
      </span>
      <span class="bar" aria-hidden="true"><span style:width={`${total ? (done / total) * 100 : 0}%`}></span></span>
      <span class="muted meta">{done} de {total} series</span>
    </a>
    <div class="more"><OverflowMenu items={[{ label: 'Cancelar entrenamiento', icon: 'trash', danger: true, disabled: busy, onselect: cancel }]} /></div>
  </div>
{/if}

<style>
  .wrap {
    position: relative;
    margin: 0.5rem 0 1rem;
  }
  .live {
    display: grid;
    gap: 0.45rem;
    padding: 1rem;
    border-radius: 20px;
    background: var(--surface);
    box-shadow: 0 0 0 1px rgb(255 106 43 / 0.35) inset;
    color: var(--text);
    text-decoration: none;
    transition: background-color 160ms var(--ease);
  }
  .live:active {
    background: var(--surface-hi);
  }
  .top {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-right: 2.5rem;
    font-size: var(--t-sm);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }
  .label {
    color: var(--accent-hi);
    font-weight: 600;
  }
  .time {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .row :global(svg) {
    color: var(--accent-hi);
  }
  .name {
    font-size: var(--t-lg);
    font-weight: 650;
  }
  .bar {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--raised);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 300ms var(--ease);
  }
  .meta {
    font-size: var(--t-sm);
  }
  .more {
    position: absolute;
    top: 0.45rem;
    right: 0.45rem;
  }
</style>
