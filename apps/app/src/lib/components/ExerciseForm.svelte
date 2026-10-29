<script lang="ts" module>
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
  <label>Nombre <input required minlength="2" maxlength="60" bind:value={name} /></label>
  <label>
    Músculo principal
    <select bind:value={primaryMuscle}>
      {#each MUSCLE_GROUPS as m}<option value={m}>{MUSCLE_LABELS[m]}</option>{/each}
    </select>
  </label>
  <fieldset>
    <legend class="muted">Músculos secundarios</legend>
    <div class="chips">
      {#each MUSCLE_GROUPS.filter((m) => m !== primaryMuscle) as m}
        <button type="button" class="chip" class:on={secondary.includes(m)} onclick={() => toggleSecondary(m)}>
          {MUSCLE_LABELS[m]}
        </button>
      {/each}
    </div>
  </fieldset>
  <label>
    Equipo
    <select bind:value={equipment}>
      {#each EQUIPMENT as e}<option value={e}>{EQUIPMENT_LABELS[e]}</option>{/each}
    </select>
  </label>
  <label>
    Tipo
    <select bind:value={exerciseType}>
      {#each EXERCISE_TYPES as t}<option value={t}>{TYPE_LABELS[t]}</option>{/each}
    </select>
  </label>
  <label>Instrucciones (opcional) <textarea rows="4" maxlength="2000" bind:value={instructions}></textarea></label>
  <label>Enlace de vídeo (opcional) <input type="url" maxlength="300" bind:value={videoUrl} /></label>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <button class="primary" disabled={busy}>{submitLabel}</button>
</form>

<style>
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.4rem;
  }
  .chip {
    padding: 0.35rem 0.7rem;
    border-radius: 1rem;
    font-size: 0.9rem;
  }
  .chip.on {
    background: var(--accent);
    color: #052e16;
    border-color: var(--accent);
  }
  textarea {
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #334155;
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }
</style>
