<script lang="ts">
  import { t } from '#lib/i18n';
  import { PROGRAM_LIMITS, type SetPlan, type SetType } from '@gym-up/contracts';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from './Icon.svelte';
  import SetTypeCell from './SetTypeCell.svelte';
  import { coachSay } from '#lib/coach/coach.svelte';

  /** `last`: weights (kg) of the last session's working sets, to tease when a planned weight goes below them. */
  let {
    sets = $bindable(),
    unit = 'kg',
    last = [],
    onchange,
  }: { sets: SetPlan; unit?: 'kg' | 'lbs'; last?: number[]; onchange: () => void } = $props();

  const KG_PER_LB = 0.45359237;
  /** The plan stores kilos; the boxes show the user's unit. Empty means "no target weight". */
  const shown = (kg: number | undefined) => (kg === undefined ? '' : unit === 'lbs' ? Math.round((kg / KG_PER_LB) * 10) / 10 : kg);

  function setWeight(i: number, raw: string) {
    const v = raw.trim() === '' ? undefined : Math.max(0, Number(raw));
    const kg = v === undefined || Number.isNaN(v) ? undefined : unit === 'lbs' ? Math.round(v * KG_PER_LB * 10) / 10 : v;
    const { weight: _old, ...rest } = sets[i]!;
    sets[i] = kg === undefined ? rest : { ...rest, weight: kg };
    onchange();
  }

  function setReps(i: number, reps: number) {
    sets[i] = { ...sets[i]!, reps: Math.min(PROGRAM_LIMITS.maxReps, Math.max(1, reps)) };
    onchange();
  }

  /** Warm-ups always come first, in the order they were added; the rest keep their order. */
  function grouped(list: SetPlan): SetPlan {
    return [...list.filter((s) => s.type === 'warmup'), ...list.filter((s) => s.type !== 'warmup')];
  }

  function setType(i: number, type: SetType) {
    sets[i] = { ...sets[i]!, type };
    sets = grouped(sets);
    onchange();
  }

  /** Working sets are numbered 1, 2, 3… after the warm-ups. */
  const number = (i: number) => sets.slice(0, i + 1).filter((s) => s.type !== 'warmup').length;

  function add() {
    if (sets.length >= PROGRAM_LIMITS.maxSets) return;
    const last = sets[sets.length - 1];
    sets.push({
      reps: last?.reps ?? 10,
      type: last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal'),
      ...(last?.weight !== undefined && last.type !== 'warmup' ? { weight: last.weight } : {}),
    });
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
    <span>{t('plan.set')}</span>
    <span>{t('plan.reps')}</span>
    <span>{unit.toUpperCase()}</span>
    <span></span>
  </div>
  {#each sets as s, i (i)}
    <div class="row" transition:slide={{ duration: 200, easing: cubicOut }}>
      <SetTypeCell n={number(i)} type={s.type} onpick={(type) => setType(i, type)} />
      <input
        class="reps"
        type="number"
        inputmode="numeric"
        min="1"
        max={PROGRAM_LIMITS.maxReps}
        value={s.reps}
        aria-label={t('plan.setReps', { n: i + 1 })}
        onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
        oninput={(e) => {
          const v = Number((e.currentTarget as HTMLInputElement).value);
          if (v >= 1) setReps(i, v);
        }}
      />
      <input
        class="reps"
        type="number"
        inputmode="decimal"
        min="0"
        step="0.5"
        placeholder="–"
        value={shown(s.weight)}
        aria-label={t('plan.setWeight', { n: i + 1, unit })}
        onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
        oninput={(e) => setWeight(i, (e.currentTarget as HTMLInputElement).value)}
        onchange={() => {
          const kg = sets[i]?.weight;
          const before = sets[i]?.type === 'warmup' ? undefined : (last[number(i) - 1] ?? last.at(-1));
          if (kg !== undefined && kg > 0 && before !== undefined && kg < before) coachSay('weightDrop', { weight: `${shown(kg)} ${unit}` });
        }}
      />
      <button type="button" class="del" disabled={sets.length <= 1} aria-label={t('plan.removeSet', { n: i + 1 })} onclick={() => remove(i)}>
        <Icon name="x" size={18} />
      </button>
    </div>
  {/each}
  <button type="button" class="add" disabled={sets.length >= PROGRAM_LIMITS.maxSets} onclick={add}><Icon name="plus" size={16} /> {t('plan.addSet')}</button>
</div>

<style>
  .plan {
    display: grid;
    gap: 0.5rem;
  }
  .head,
  .row {
    display: grid;
    grid-template-columns: 48px 1fr 1fr 40px;
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
    min-height: 48px;
    padding: 0;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--t-lg);
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .reps::-webkit-inner-spin-button,
  .reps::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
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
