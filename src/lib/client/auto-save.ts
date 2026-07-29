// src/lib/client/auto-save.ts
//
// Client-side auto-save module for the workout page (story 2.4).
//
// Attaches event listeners (input + change) to a root element using
// event delegation. When any input inside a `.set-row` matching the
// per-row fields (reps, weight, completed, notes) changes, the module:
//   1. Resolves the row's (exerciseId, setNumber) from data attributes.
//   2. Clears the debounce timer for that key (per-row coalescing).
//   3. Sets a new 500ms debounce timer.
//   4. On fire: collects the row's current values + workoutId +
//      weightUnit, POSTs JSON to the endpoint, handles the response.
//   5. On success: clears the `set-row-error` class.
//   6. On failure: logs to console + adds `set-row-error` class for
//      inline error feedback (AC-2.4-06).
//
// Testable: all side effects (fetch, setTimeout) are injected. The
// page wires it up via:
//   import { createAutoSave } from '../lib/client/auto-save';
//   const autoSave = createAutoSave({ workoutId, weightUnit });
//   autoSave.attach(document.body);

export type WeightUnit = 'kg' | 'lbs';

export interface AutoSaveOptions {
  workoutId: string;
  weightUnit: WeightUnit;
  debounceMs?: number;
  endpoint?: string;
  fetchFn?: typeof fetch;
  setTimeoutFn?: (cb: () => void, ms: number) => number;
  clearTimeoutFn?: (id: number) => void;
  onError?: (row: HTMLElement, err: unknown) => void;
  onSuccess?: (row: HTMLElement, kind: 'created' | 'updated') => void;
}

export interface AutoSaveHandle {
  attach: (root: HTMLElement) => void;
  /** No-op: listener removal is a known limitation (see comment). */
  detach: () => void;
}

const FIELD_SELECTOR =
  'input[name$="[reps]"], input[name$="[weight]"], input[name$="[completed]"], input[name$="[notes]"]';

export function createAutoSave(options: AutoSaveOptions): AutoSaveHandle {
  const {
    workoutId,
    weightUnit,
    debounceMs = 500,
    endpoint = '/api/workout-entries',
    fetchFn = fetch,
    setTimeoutFn = (cb, ms) => window.setTimeout(cb, ms),
    clearTimeoutFn = (id) => window.clearTimeout(id),
    onError,
    onSuccess,
  } = options;
  const timers = new Map<string, number>();
  let attached = false;

  function handle(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches(FIELD_SELECTOR)) return;
    const row = target.closest<HTMLLIElement>('.set-row');
    if (!row) return;

    const exerciseIdInput = row.querySelector<HTMLInputElement>('input[name$="[exercise_id]"]');
    const exerciseId = exerciseIdInput?.value;
    const setNumber = row.dataset.setNumber;
    if (!exerciseId || !setNumber) return;

    const key = `${exerciseId}:${setNumber}`;
    const existingTimer = timers.get(key);
    if (existingTimer !== undefined) clearTimeoutFn(existingTimer);

    const timerId = setTimeoutFn(async () => {
      const payload = collectRowData(row, workoutId, weightUnit);
      if (!payload) return;
      try {
        const res = await fetchFn(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.error('[auto-save] failed:', res.status, errBody);
          row.classList.add('set-row-error');
          onError?.(row, errBody);
          return;
        }
        const result = (await res.json()) as { kind: 'created' | 'updated' };
        row.classList.remove('set-row-error');
        onSuccess?.(row, result.kind);
      } catch (err) {
        console.error('[auto-save] error:', err);
        row.classList.add('set-row-error');
        onError?.(row, err);
      }
    }, debounceMs);
    timers.set(key, timerId);
  }

  return {
    attach(root: HTMLElement) {
      if (attached) return;
      attached = true;
      root.addEventListener('input', handle);
      root.addEventListener('change', handle);
    },
    detach() {
      // Known limitation: we don't keep a reference to `handle` (it closes
      // over `timers`), so we cannot call root.removeEventListener here.
      // For 2.4, the page is SSR and never unmounts, so this is a no-op.
      // If SPA navigation is added later, the module should keep the
      // listener reference and remove it here.
      attached = false;
    },
  };
}

function collectRowData(
  row: HTMLLIElement,
  workoutId: string,
  weightUnit: WeightUnit,
): Record<string, unknown> | null {
  const setNumber = Number(row.dataset.setNumber);
  const exerciseIdInput = row.querySelector<HTMLInputElement>('input[name$="[exercise_id]"]');
  const exerciseId = exerciseIdInput?.value;
  if (!exerciseId || isNaN(setNumber)) return null;

  const repsInput = row.querySelector<HTMLInputElement>('input[name$="[reps]"]');
  const weightInput = row.querySelector<HTMLInputElement>('input[name$="[weight]"]');
  const completedInput = row.querySelector<HTMLInputElement>('input[name$="[completed]"]');
  const notesInput = row.querySelector<HTMLInputElement>('input[name$="[notes]"]');

  return {
    workoutId,
    exerciseId,
    setNumber,
    reps: Number(repsInput?.value ?? 0),
    weight: Number(weightInput?.value ?? 0),
    weightUnit,
    completed: completedInput?.checked ?? false,
    notes: notesInput?.value || null,
  };
}
