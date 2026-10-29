import type { SetType } from '@gym-up/contracts';

/** The kinds of set, in menu order. `short` is the letter shown instead of the set number. */
export const SET_TYPES: readonly { value: SetType; label: string; short: string; hint: string }[] = [
  { value: 'normal', label: 'Normal', short: '', hint: 'Serie de trabajo' },
  { value: 'warmup', label: 'Calentamiento', short: 'C', hint: 'No cuenta para el volumen' },
  { value: 'drop', label: 'Dropset', short: 'D', hint: 'Bajas el peso sin descansar' },
  { value: 'failure', label: 'Al fallo', short: 'F', hint: 'Hasta no poder otra rep' },
];

export const setTypeOf = (t: SetType | undefined) => SET_TYPES.find((x) => x.value === (t ?? 'normal'))!;
