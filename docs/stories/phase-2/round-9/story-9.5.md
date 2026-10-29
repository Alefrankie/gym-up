---
story_id: "9.5"
round: "round-9"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking", "progress"]
  prd_requirements: ["FR-WT-040", "FR-WT-041", "FR-WT-042"]
  architecture_decisions: ["ADR-020"]
  flows: []
blocked_by: ["story-9.2", "story-9.4"]
blocks: ["story-12.5"]
---

# Story 9.5 — Gym tools: plate calculator, warm-up generator, 1RM calculator

Parent: [../readme.md](../readme.md)

## Summary

Adds the three Hevy gym tools: a plate calculator sheet opened from the weight input of barbell and smith-machine sets, a warm-up generator in the exercise menu, and a 1RM calculator page under *Perfil → Herramientas*. The calculators are pure functions in the user's display unit; the estimated 1RM uses the Epley `e1rm()` that this story creates in the shared `personal-records.ts` module, so story 10.1 extends that file instead of redefining the formula. Closes Hevy row H22.

## Files in scope

**Modify**

- `src/components/live-workout/set-row.tsx` — 🏋 button next to the weight input for `barbell` / `smith_machine` exercises.
- `src/components/live-workout/exercise-block.tsx` — *Añadir calentamiento* menu item.
- `src/components/live-workout/live-workout.reducer.ts` and `live-workout.commands.ts` — action `exercise/warmups-added`.
- `src/lib/contexts/progress/domain/progress.constants.ts` — add `RecordRules` (`E1rmMaxReps: 12`, `RepMaxTableMax: 12`, `PaceMinDistanceM: 400`, per [ADR-020](../../../architecture/decisions/020-personal-records.md)).
- `src/lib/app-shell/shell-features.ts` (story 9.4) — flip `tools` to `true` so the hub shows *Herramientas*.
- `tests/workout-tracking/live-workout.reducer.test.ts` — add the `exercise/warmups-added` rows.

**Create**

- Pure modules (`src/lib/contexts/workout-tracking/domain/`): `plate-calculator.ts` (`calculatePlates`), `warmup-generator.ts` (`generateWarmupSets`), `one-rm-table.ts` (`oneRmTable`), `gym-tools-rules.ts` (`canShowPlateButton(equipment)`, `canAddWarmups(exerciseType)`, `resolveFirstWorkingWeight(sets)`, `validateOneRmInput(weight, reps, unit)`; keeps the visibility and validation rules testable without a DOM).
- `src/lib/contexts/progress/domain/personal-records.ts` — only `e1rm(weight, reps)` for now; story 10.1 adds `isEligibleSet`, `computeRecords`, `detectPrs` and the rest to the same file.
- Components (`src/components/gym-tools/`): `plate-calculator-sheet.tsx`, `warmup-generator.tsx`, `one-rm-calculator.tsx`.
- Page: `src/pages/profile/tools.astro`.
- Tests: see [Test Plan](#test-plan).

**Not in scope** (must not change): `db/`, `supabase/` (nothing is persisted by the tools); `src/pages/api/**` (no new endpoint); the progress context's stats and records modules beyond `e1rm`.

## Decisions

- Plate calculator and warm-up generator compute in the **display unit** (plates converted from kg and rounded to 0.01) so lb users never see drift such as 44.99 lb ([workout-tracking readme](../../../architecture/contexts/workout-tracking/readme.md#pure-domain-modules)). The reducer receives warm-up weights already converted to kg.
- "Loadable" means the greedy pass (largest plate first, unlimited quantity of each plate, per side) leaves no remainder, as the FR specifies greedy. The nearest lower weight is what the greedy pass actually loads (`bar + 2 × loaded per side`); the nearest upper weight is the smallest `loaded + j × smallest plate` (j = 1, 2, …) that is at least the per-side target and is itself greedy-loadable. The empty bar is always loadable. A target below the bar has no lower neighbour and the upper one is the bar; an upper neighbour above `WorkoutEntryRules.MaxWeight` is `null`. A custom plate set whose only exact combination is non-greedy therefore reports its nearest greedy-loadable weights.
- Warm-up rounding picks the nearest loadable weight, ties go to the lower one. A warm-up is skipped when its **raw** target (`percent × first working weight`) is below the empty bar; a target equal to the bar is kept (empty-bar set). If every step is skipped the sheet shows "Sin calentamientos para este peso".
- *Añadir calentamiento* appears only for `weight_reps` and `weighted_bodyweight` exercises (the only types with a loadable weight and reps). For `barbell` / `smith_machine` the bar is `barWeightKg`; for other equipment the generator is called with bar `0`, so weights round to multiples of `2 × smallest plate` and a raw target that rounds to 0 is skipped.
- The first working weight is the weight of the first non-warm-up set that has one, else that set's prefill, else none (the sheet asks for it and disables *Añadir*).
- New warm-up rows go directly before the first working set, after any existing leading warm-ups; all `setNumber`s are renumbered; the action is ignored (and the button disabled with "Máximo 20 series") when the result would exceed `MaxSetsPerExercise`.
- 1RM table: the weight at each percent is `e1RM × percent / 100` rounded to 0.5 in the display unit ([ADR-020 §2](../../../architecture/decisions/020-personal-records.md): rounding is display-only). The reps range is the inverse Epley, `reps = 30 × (100 − p) / p` (multiply first, to avoid float noise), shown as `floor–ceil` and collapsed to one number when it is an integer. FR-WT-042 gives no mapping, so this is the simplest option consistent with Epley.
- Plate colors on the bar drawing come from a 6-token palette by descending plate rank; the drawing is decorative (`aria-hidden`), the text list carries the meaning.

## Happy Path

1. On a barbell set the user taps 🏋 next to the weight. `PlateCalculatorSheet` opens: a bar drawing with colored plates per side and "Por lado: 20 + 10 + 2.5" for the typed weight ([FR-WT-040](../../../prd/features/workout-tracking.md#fr-wt-040)).
2. For a weight that cannot be loaded (101 kg) the sheet shows "No se puede cargar exacto · 100 kg / 102.5 kg"; tapping one sets the row weight and closes the sheet.
3. In the exercise menu the user taps *Añadir calentamiento*. `WarmupGenerator` previews 40 % × 10, 60 % × 5, 80 % × 3 of the first working weight rounded to loadable weights; *Añadir* inserts them as `W` rows before the first working set ([FR-WT-041](../../../prd/features/workout-tracking.md#fr-wt-041)).
4. Later the user opens *Perfil → Herramientas → Calculadora 1RM*, types 100 kg × 5 and sees e1RM 116.5 kg and the table 50–95 % ([FR-WT-042](../../../prd/features/workout-tracking.md#fr-wt-042)).

## Acceptance Criteria

- AC-9.5-01: `calculatePlates(target, bar, plates)` returns plates per side, largest first, for loadable weights; for others `loadable: false` with `nearestLower` / `nearestUpper`; a target equal to the bar returns an empty list; a target below the bar returns `nearestLower: null` and `nearestUpper = bar`. Table tests use the worked examples below, in kg and lb, and assert no float drift (45 lb bar, 2.5 lb steps).
- AC-9.5-02: `PlateCalculatorSheet` opens from the 🏋 button only on `barbell` and `smith_machine` exercises, uses the bar and plates from `TrainingSettings` in the display unit, shows the drawing and the "Por lado" list, and for an unloadable weight shows two buttons that dispatch `set/changed` with that weight (converted to kg). It is a bottom sheet below 768 px with tap targets ≥ 44 px.
- AC-9.5-03: `generateWarmupSets(firstWorkingWeight, bar, plates)` applies `WarmupScheme` (40 % × 10, 60 % × 5, 80 % × 3), rounds to the nearest loadable weight (ties lower), skips targets below the empty bar, keeps a target equal to the bar, and returns display-unit weights; worked examples below.
- AC-9.5-04: *Añadir calentamiento* appears only for `weight_reps` and `weighted_bodyweight`. The sheet resolves the first working weight per the decisions, shows "Introduce el peso de la primera serie" with *Añadir* disabled when there is none, and uses bar `0` for equipment other than barbell and smith machine.
- AC-9.5-05: `exercise/warmups-added` inserts unchecked `warmup` rows (weights in kg) directly before the first working set, renumbers all sets densely and emits one `upsert-set` per new and per renumbered set; it is a no-op when the result would exceed 20 sets (table tests in the reducer test, including an exercise that already has warm-ups and one with none).
- AC-9.5-06: `e1rm(weight, reps)` in `progress/domain/personal-records.ts` is Epley, returns `weight` for 1 rep, and `null` when `reps` is null, below 1 or above `RecordRules.E1rmMaxReps` (12); no other file defines the formula, and the module has no I/O so the island and the server import the same function. Worked examples below.
- AC-9.5-07: `/profile/tools` (authenticated, redirects to `/login` otherwise) renders `OneRmCalculator` with `client:visible`. Weight must be > 0 and ≤ the 500 kg maximum in the display unit and reps an integer 1–12, otherwise inline errors ("Introduce un peso mayor que 0", "Las repeticiones deben estar entre 1 y 12"). It outputs e1RM and the 50–95 % table (5 % steps) in the user's unit, entirely client-side with no API call and nothing persisted.
- AC-9.5-08: The tools work without a network once the page is loaded (pure client code), `Herramientas` appears in the `/profile` hub, and inputs use `inputmode="decimal"` (weight) and `"numeric"` (reps) at 360 px with targets ≥ 44 px (NFR-WT-P2-04).

Worked examples (kg unless noted):

| Function | Input | Expected |
|---|---|---|
| `calculatePlates` | target 100, bar 20, plates 25,20,15,10,5,2.5,1.25 | per side 25 + 15 |
| | target 62.5 | per side 20 + 1.25 |
| | target 97.5 | per side 25 + 10 + 2.5 + 1.25 |
| | target 20 | empty, loadable |
| | target 101 | not loadable, lower 100, upper 102.5 |
| | target 15 | not loadable, lower `null`, upper 20 |
| | lb: target 225, bar 45, plates 45,35,25,10,5,2.5 | per side 45 + 45 |
| | lb: target 185 | per side 45 + 25 |
| | custom plates 25,20,10, bar 20, target 80 | not loadable (greedy leaves 5), lower 70, upper 90 |
| `generateWarmupSets` | first 100, bar 20, default plates | 40 × 10, 60 × 5, 80 × 3 |
| | first 52.5 | 20 × 10, 32.5 × 5, 42.5 × 3 |
| | first 30 | 25 × 3 (raw 12 and 18 are below the bar) |
| | first 22.5 | none (all raw targets below the bar) |
| | lb: first 225, bar 45, lb plates | 90 × 10, 135 × 5, 180 × 3 |
| `e1rm` | (100, 5) · (100, 1) · (60, 12) · (80, 13) · (80, 0) · (80, null) | 116.67 · 100 · 84 · null · null · null |
| `oneRmTable` | e1RM from 100 × 5 (116.67), kg | 95 %: 111 kg, 1–2 reps · 90 %: 105, 3–4 · 85 %: 99, 5–6 · 80 %: 93.5, 7–8 · 75 %: 87.5, 10 · 70 %: 81.5, 12–13 · 65 %: 76, 16–17 · 60 %: 70, 20 · 55 %: 64, 24–25 · 50 %: 58.5, 30 |

## Tasks

- [ ] `T9.5-01` - `personal-records.ts` with `e1rm()` and `RecordRules` in `progress.constants.ts`; `tests/progress/personal-records.test.ts` with the e1rm table
- [ ] `T9.5-02` - `plate-calculator.ts` with table tests (kg, lb, custom plates, edge cases)
- [ ] `T9.5-03` - `warmup-generator.ts` with table tests
- [ ] `T9.5-04` - `one-rm-table.ts` and `gym-tools-rules.ts` with table tests
- [ ] `T9.5-05` - Reducer action and command for `exercise/warmups-added` with table rows
- [ ] `T9.5-06` - `plate-calculator-sheet.tsx` and the 🏋 button in `set-row.tsx`
- [ ] `T9.5-07` - `warmup-generator.tsx` and the menu item in `exercise-block.tsx` (type gating, first-weight resolution, bar rule)
- [ ] `T9.5-08` - `one-rm-calculator.tsx`, `/profile/tools` page, flip `ShellFeatures.tools`
- [ ] `T9.5-09` - Update docs: mark context Use Cases and domain-module rows `implemented`, fix any doc/code drift found (e1rm location, warm-up bar rule), add Implementation Evidence

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/workout-tracking/plate-calculator.test.ts` | unit (table) | Greedy plates, unloadable neighbours, below-bar, lb without drift, custom plates (01) |
| `tests/workout-tracking/warmup-generator.test.ts` | unit (table) | Scheme, rounding ties, below-bar skip, equal-to-bar kept, lb, none left (03) |
| `tests/workout-tracking/one-rm-table.test.ts` | unit (table) | 50–95 % table, rep ranges, 0.5 rounding, lb (07) |
| `tests/progress/personal-records.test.ts` | unit (table) | `e1rm` examples and null cases (06); 10.1 extends this file |
| `tests/workout-tracking/live-workout.reducer.test.ts` | unit (table) | `exercise/warmups-added`: position, renumbering, commands, 20-set guard (05) |
| `tests/workout-tracking/gym-tools-rules.test.ts` | unit (table) | Plate-button and warm-up visibility by equipment and type, first-working-weight resolution, bar rule, 1RM input validation messages (02, 04, 07) |

## Out of Scope

- Set rows, the weight input and the row menu themselves → [story-9.2](./story-9.2.md); the `/profile` hub and `ShellFeatures` → [story-9.4](./story-9.4.md).
- Records, PR detection and the rest of `personal-records.ts` → [story-10.1](../round-10/story-10.1.md).
- Per-user custom rep-range tables or a separate distance unit setting (not in Hevy's calculator).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
