<script lang="ts" module>
  import Select from '#lib/components/Select.svelte';
  export interface ExerciseFormValue {
    name: string;
    primaryMuscle: string;
    secondaryMuscles: string[];
    equipment: string;
    exerciseType: string;
    instructions: string | null;
    videoUrl: string | null;
  }
</script>

<script lang="ts">
  import { t } from '#lib/i18n';
  import { EQUIPMENT, EXERCISE_TYPES, MUSCLE_GROUPS, type LibraryExerciseDto } from '@gym-up/contracts';
  import { EQUIPMENT_LABELS, MUSCLE_LABELS, TYPE_LABELS } from '#lib/labels';

  let {
    initial,
    busy,
    error,
    submitLabel,
    onsubmit,
  }: {
    initial?: LibraryExerciseDto;
    busy: boolean;
    error: string | null;
    submitLabel: string;
    onsubmit: (value: ExerciseFormValue) => void;
  } = $props();

  let name = $state(initial?.name ?? '');
  let primaryMuscle = $state<string>(initial?.primaryMuscle ?? 'chest');
  let secondary = $state<string[]>(initial?.secondaryMuscles ?? []);
  let equipment = $state<string>(initial?.equipment ?? 'dumbbell');
  let exerciseType = $state<string>(initial?.exerciseType ?? 'weight_reps');
  let instructions = $state(initial?.instructions ?? '');
  let videoUrl = $state(initial?.videoUrl ?? '');

  function toggleSecondary(m: string) {
    secondary = secondary.includes(m) ? secondary.filter((x) => x !== m) : [...secondary, m];
  }

  function submit(ev: SubmitEvent) {
    ev.preventDefault();
    onsubmit({
      name,
      primaryMuscle,
      secondaryMuscles: secondary.filter((m) => m !== primaryMuscle),
      equipment,
      exerciseType,
      instructions: instructions || null,
      videoUrl: videoUrl || null,
    });
  }
</script>

<form onsubmit={submit}>
  <label>{t('programs.name')} <input required minlength="2" maxlength="60" bind:value={name} /></label>
  <label>
    {t('exercise.primaryMuscle')}
    <Select bind:value={primaryMuscle} options={MUSCLE_GROUPS.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }))} />
  </label>
  <fieldset>
    <legend class="muted">{t('exercise.secondaryMuscles')}</legend>
    <div class="chips">
      {#each MUSCLE_GROUPS.filter((m) => m !== primaryMuscle) as m}
        <button type="button" class="chip" class:on={secondary.includes(m)} aria-pressed={secondary.includes(m)} onclick={() => toggleSecondary(m)}>
          {MUSCLE_LABELS[m]}
        </button>
      {/each}
    </div>
  </fieldset>
  <label>
    {t('library.equipment')}
    <Select bind:value={equipment} options={EQUIPMENT.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))} />
  </label>
  <label>
    {t('exercise.type')}
    <Select bind:value={exerciseType} options={EXERCISE_TYPES.map((ty) => ({ value: ty, label: TYPE_LABELS[ty] }))} />
  </label>
  <label>{t('exercise.instructions')} <textarea rows="4" maxlength="2000" bind:value={instructions}></textarea></label>
  <label>{t('exercise.videoUrl')} <input type="url" maxlength="300" bind:value={videoUrl} /></label>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <button class="primary" disabled={busy}>{submitLabel}</button>
</form>

<style>
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }
  legend {
    padding: 0;
    font-size: var(--t-sm);
    font-weight: 500;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.4rem;
  }
  .chips .chip {
    cursor: pointer;
    font-weight: 500;
  }
</style>
