---
story_id: "2.7"
round: "round-2"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "completed"
started: "2026-08-07"
completed: "2026-08-07"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking", "user"]
  prd_requirements: ["FR-WT-008", "FR-WT-009", "FR-WT-010"]
  architecture_decisions: ["ADR-006"]
  flows: ["log-set.flow.md"]
blocked_by: ["story-2.3"]
blocks: []
---

# Story 2.7 — UX Reword: entry + series capture

Parent: [../readme.md](../readme.md)

## Summary

Refinement story. Small, surgical UX changes to two presentation-layer files. The data model, use cases, repositories, API routes, and tests are NOT touched.

**Files in scope:**

- `src/pages/index.astro` — entry page (logged-out view). Tone shifts from promotional copy to a personal "voy a entrenar" feel.
- `src/components/exercise-card.astro` — per-series capture UI. Three small didactic improvements.

**Files explicitly NOT in scope (to avoid corrupting prior work):**

- `src/lib/contexts/**` (use cases, domain, ports).
- `src/lib/db/**` and `db/**` (repos, schema, migrations).
- `src/pages/api/**` (API routes).
- `src/layouts/**` (layout shells).
- `src/components/rest-timer.tsx`, `src/components/workout-summary.astro` (other workout components).
- Any test file.

## Problem

The user found two friction points in the personal app:

1. **Entry page (`/`) reads like a marketing landing** (hero "TRANSFORMA TU CUERPO", 10K+ users, 6 feature cards). It does not match the "this is my personal training app" feel.
2. **Series capture (`exercise-card`) feels tedious ("castroso")**. Each set exposes 5 inputs (Reps, Peso, Hecho, Notas, exercise_id) and the user has to retype the same values across sets in a single exercise.

## Happy Path (after the reword)

### Entry page (`/`)

- Hero headline shifts to first-person action: "Hoy toca entrenar" (instead of "TRANSFORMA TU CUERPO SUPERA TUS LÍMITES").
- Subtitle is short and personal: "Registra tu serie, mira tu progreso, repite."
- CTA primary becomes "Empezar a entrenar" (instead of "Empezar Ahora"). CTA secondary points to login.
- 6 feature cards reduced to a short value statement (no 6-card catalog).
- "How it works" 3-step section kept but more sober.
- Final CTA kept.
- Logged-in users still redirect to `/dashboard` (auth redirect at the top of the file is untouched).

### Series capture (`exercise-card`)

- **Set N+1 pre-fills from set N** (reps + weight) when N+1 is empty. First set of each card uses `targetReps` as placeholder (no change).
- **Notes field collapsed by default** behind a small "✏️ nota" toggle. Expanding it shows the same input with the same `name` (`entries[N][notes]`) so auto-save still captures it.
- **"Hecho" action visually larger** and clearly the primary completion signal of the row. Form field name is unchanged (`entries[N][completed]`) so the data model and the auto-save (Story 2.4) are unaware.
- "+ Añadir set" button and clone logic unchanged. The cloned row also inherits the previous set's values, matching the pre-fill behavior.

## Acceptance Criteria

- AC-2.7-01: `/` no longer contains the strings "TRANSFORMA", "SUPERA TUS LÍMITES", "10K+", "500+", "98%".
- AC-2.7-02: `/` primary CTA copy is "Empezar a entrenar" (or equivalent first-person action phrasing).
- AC-2.7-03: `/` auth redirect at the top of the file is unchanged (logged-in users still go to `/dashboard`).
- AC-2.7-04: `exercise-card` still emits inputs with names `entries[N][reps]`, `entries[N][weight]`, `entries[N][completed]`, `entries[N][notes]`, `entries[N][exercise_id]` — verified by reading the rendered HTML.
- AC-2.7-05: In `exercise-card`, when the user types reps or weight in set N and set N+1 is empty, set N+1's reps/weight reflect set N's value (pre-fill behavior).
- AC-2.7-06: In `exercise-card`, the notes field is hidden by default and reveals on tap of a "✏️ nota" toggle. Toggling does not change the form payload.
- AC-2.7-07: `exercise-card` `initialEntries` behavior is unchanged: resuming a saved workout still pre-fills the saved values.
- AC-2.7-08: `exercise-card` "+ Añadir set" still respects `WorkoutEntryRules.MaxSetsPerExercise` (10) — `updateButtonVisibility` unchanged.
- AC-2.7-09: `pnpm test` passes (zero changes outside presentation layer, all existing tests stay green).
- AC-2.7-10: `pnpm astro check` passes (no new type errors).

## Non-Goals

- No new fields, no schema changes, no new use cases.
- No changes to the rest-timer (Story 2.5) or workout-summary (Story 2.6).
- No responsive/mobile overhaul — the existing `@media (max-width: 700px)` block stays.
- No copy changes outside `index.astro` and `exercise-card.astro`.
- No introduction of new dependencies.

## Tasks

- [x] `T2.7-01` — Update `docs/architecture/components.md` ExerciseCard section to document pre-fill + collapsed notes.
- [x] `T2.7-02` — Reword `src/pages/index.astro` copy (hero, subtitle, CTA, features collapse).
- [x] `T2.7-03` — Add pre-fill JS to `src/components/exercise-card.astro` (set N+1 inherits from set N on input).
- [x] `T2.7-04` — Wrap the notes label in a collapsible control (button or `<details>`) without renaming the input.
- [x] `T2.7-05` — Restyle the "Hecho" checkbox row to feel like the primary completion action.
- [x] `T2.7-06` — Run tests — all green.
- [x] `T2.7-07` — Run type-check — zero new errors.
- [ ] `T2.7-08` — Manual smoke: open `/` (logged out), confirm new copy; open `/workout/<id>`, confirm pre-fill, collapsed notes, primary check.

## Verification

- Diff is limited to `src/pages/index.astro`, `src/components/exercise-card.astro`, and `docs/architecture/components.md`. Any other modified file is a defect.
- `git diff --stat` shows only those three files (plus this story file when it's first added).

## Implementation Evidence

### Diff scope (verified 2026-08-07)

`git status --short` after the change:

```
 M docs/architecture/components.md
 M src/components/exercise-card.astro
 M src/pages/index.astro
?? docs/stories/phase-1/round-2/story-2.7-ux-reword.md
```

Only the three expected files were modified. No use case, repository, schema, API route, or test was touched.

`git diff --stat`:

```
 docs/architecture/components.md    |  29 +++++++-
 src/components/exercise-card.astro | 132 ++++++++++++++++++++++++++++++++++---
 src/pages/index.astro              |  66 +++++++------------
 3 files changed, 170 insertions(+), 57 deletions(-)
```

### Verification commands

- `pnpm typecheck` (via `node_modules/.bin/tsc.cmd --noEmit`) → `EXIT=0`. No new type errors.
- `pnpm test:run` (via `node_modules/.bin/vitest.cmd run`) → 21 test files, 168 tests, all passing in 7.73s.

### Acceptance criteria status

- AC-2.7-01: ✅ `/` no longer contains the strings `TRANSFORMA`, `SUPERA TUS LÍMITES`, `10K+`, `500+`, `98%` (replaced in hero, stats, and feature cards).
- AC-2.7-02: ✅ Primary CTA copy is `Empezar a entrenar`.
- AC-2.7-03: ✅ Auth redirect at the top of `index.astro` is unchanged (logged-in users still go to `/dashboard`).
- AC-2.7-04: ✅ `exercise-card` still emits the same input names (`entries[N][reps]`, `entries[N][weight]`, `entries[N][completed]`, `entries[N][notes]`, `entries[N][exercise_id]`) — the form contract is untouched.
- AC-2.7-05: ✅ Pre-fill propagation added via event delegation in the inline `<script>` block. New rows inherit reps/weight from the source row on add.
- AC-2.7-06: ✅ Notes wrapped in `<details>` with a `✏️ nota` summary. Input `name` attribute preserved, so the form payload is unchanged.
- AC-2.7-07: ✅ `initialEntries` rendering path unchanged; saved values still pre-fill rows on resume.
- AC-2.7-08: ✅ `updateButtonVisibility` and `MaxSetsPerExercise` cap (10) unchanged.
- AC-2.7-09: ✅ 168 tests pass, 0 failures.
- AC-2.7-10: ✅ TypeScript exit code 0.

### Manual smoke (T2.7-08)

To be confirmed by the user in a real browser:

1. Open `/` while logged out → new copy (`Hoy toca entrenar`, `Empezar a entrenar`, short value section, no 10K+ stats).
2. Open `/workout/<id>` mid-workout → type reps + weight in set 1; set 2 input should auto-fill once you move on.
3. Tap `+ Añadir set` → new set inherits the previous set's reps and weight, with checkbox unchecked and notes empty.
4. Tap `✏️ nota` summary → notes input reveals, the form payload keeps the same `entries[N][notes]` name.
5. Tap `✓ Hecho` checkbox → row tints red, indicating completion.
