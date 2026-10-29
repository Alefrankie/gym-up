<script lang="ts">
  import { PROGRAM_LIMITS, type SetPlan, type SetType } from '@gym-up/contracts';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from './Icon.svelte';
  import SetTypeCell from './SetTypeCell.svelte';

  let { sets = $bindable(), onchange }: { sets: SetPlan; onchange: () => void } = $props();

  function setReps(i: number, reps: number) {
    sets[i] = { ...sets[i]!, reps: Math.min(PROGRAM_LIMITS.maxReps, Math.max(1, reps)) };
    onchange();
  }

  function setType(i: number, type: SetType) {
    sets[i] = { ...sets[i]!, type };
    onchange();
  }

  function add() {
    if (sets.length >= PROGRAM_LIMITS.maxSets) return;
    const last = sets[sets.length - 1];
    sets.push({ reps: last?.reps ?? 10, type: last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal') });
    onchange();
  }

  function remove(i: number) {
    if (sets.length <= 1) return;
    sets.splice(i, 1);
    onchange();
  }
</script>

<div class="plan">
  <div class="head">
    <span>Serie</span>
    <span>Reps</span>
    <span></span>
  </div>
  {#each sets as s, i (i)}
    <div class="row" transition:slide={{ duration: 200, easing: cubicOut }}>
      <SetTypeCell n={i + 1} type={s.type} onpick={(type) => setType(i, type)} />
      <div class="reps">
        <button type="button" class="step" aria-label={`Menos reps en la serie ${i + 1}`} onclick={() => setReps(i, s.reps - 1)}><Icon name="down" size={18} /></button>
        <input
          type="number"
          inputmode="numeric"
          min="1"
          max={PROGRAM_LIMITS.maxReps}
          value={s.reps}
          aria-label={`Serie ${i + 1}: repeticiones`}
          onchange={(e) => setReps(i, Number((e.currentTarget as HTMLInputElement).value) || 1)}
        />
        <button type="button" class="step" aria-label={`Más reps en la serie ${i + 1}`} onclick={() => setReps(i, s.reps + 1)}><Icon name="up" size={18} /></button>
      </div>
      <button type="button" class="del" disabled={sets.length <= 1} aria-label={`Quitar serie ${i + 1}`} onclick={() => remove(i)}>
        <Icon name="x" size={18} />
      </button>
    </div>
  {/each}
  <button type="button" class="add" disabled={sets.length >= PROGRAM_LIMITS.maxSets} onclick={add}><Icon name="plus" size={16} /> Añadir serie</button>
</div>

<style>
  .plan {
    display: grid;
    gap: 0.5rem;
  }
  .head,
  .row {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    gap: 0.5rem;
    align-items: center;
  }
  .head {
    color: var(--faint);
    font-size: var(--t-xs);
    font-weight: 500;
    text-align: center;
  }
  .reps {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    min-height: 48px;
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: 0 0 0 1px var(--line) inset;
  }
  .reps input {
    min-height: 46px;
    padding: 0;
    background: none;
    box-shadow: none;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--t-lg);
  }
  .step,
  .del {
    min-height: 44px;
    padding: 0;
    background: none;
    box-shadow: none;
    color: var(--muted);
    display: grid;
    place-items: center;
  }
  .del {
    width: 48px;
    min-height: 48px;
  }
  .add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 48px;
    background: none;
    box-shadow: 0 0 0 1px var(--line) inset;
    color: var(--muted);
    font-size: var(--t-sm);
  }
</style>
