import type { SetType } from '@gym-up/contracts';
import { t } from '#lib/i18n';

/** The kinds of set, in menu order. `short` is the letter shown instead of the set number. */
// label, short and hint are getters so they follow the current language.
const kind = (value: SetType) => ({
  value,
  get label() {
    return t(`sets.${value}.label` as const);
  },
  get short() {
    return t(`sets.${value}.short` as const);
  },
  get hint() {
    return t(`sets.${value}.hint` as const);
  },
});

export const SET_TYPES: readonly { value: SetType; readonly label: string; readonly short: string; readonly hint: string }[] = [
  kind('normal'),
  kind('warmup'),
  kind('drop'),
  kind('failure'),
];

export const setTypeOf = (t: SetType | undefined) => SET_TYPES.find((x) => x.value === (t ?? 'normal'))!;
