---
id: DR-0033
title: "A drop set holds several weight drops inside one set"
status: accepted
tier: 1
date: 2026-11-07
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: "@alefrank"

scope: local
reversibility: costly
risk_flags: [data]

depends_on: [DR-0016, DR-0021]
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "apps/api/db/migrations/0007_set_type.sql"
    - "apps/api/db/migrations/0029_drop_index.sql"
    - "apps/app/src/routes/workout/[id]/[exercise]/+page.svelte"
    - "apps/app/src/lib/offline/workout-view.svelte.ts"
    - "apps/api/src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository.ts"
  issues: []
  prs: []

validation:
  criteria:
    - "A user logs 80 kg × 8 → 60 kg × 6 → 40 kg × 5 as one drop set, shown as one row with its drops beneath it"
    - "Adding a drop pre-fills the weight 25 % lower (rounded to the exercise's weight step) and the reps of the previous drop"
    - "Ticking a drop does not start the rest timer; ticking the last drop of the set does"
    - "History and summaries count that drop set as 1 set; volume adds every drop"
    - "Progression (DR-0021) still ignores drop sets"
    - "Existing workouts with consecutive `drop` rows still display and count as before"
    - "Another drop set on the same exercise is a new set (Añadir serie, mark D) that starts again from its own top weight with its own drops"
  review_by: null
  evidence: []
  validated_on: null

tags: [workout-tracking, sets, migration, ui]
---

# DR-0033 · A drop set holds several weight drops inside one set

## Context

Users describe a drop set as one continuous set: start heavy, then drop the weight with no rest
2 to 4 times (80 kg × 8 → 60 kg × 6 → 40 kg × 5). Today `set_type = 'drop'` (DR-0016) is only a
label on an ordinary row with one weight × reps. To log a real drop set the user must add 3 rows,
type every weight by hand, and mark each one `D`. Each tick starts the rest timer
(`workout-view.svelte.ts:334`), and history counts 3 drop sets where there was 1.

Hevy CSV compatibility is no longer a constraint.

## Decision

**Proposed:** A drop is a row in `workout_entries` that belongs to a parent set.

Data model (new migration):

| Column | Type | Meaning |
|---|---|---|
| `drop_index` | INTEGER NOT NULL DEFAULT 0 | 0 = the set itself (the top weight); 1, 2, 3… = each drop |

- A drop row shares `workout_exercise_id`/`set_number` with its parent and has the same
  `set_type = 'drop'`. A set is the group of rows with the same `set_number`; its identity is
  `(workout_exercise, set_number, drop_index)`. Any unique index on `set_number` widens to include
  `drop_index`.
- Every drop keeps its own `weight`, `reps`, `completed`. Normal, warm-up and failure sets always
  have `drop_index = 0`.
- Volume sums every completed row. Set counts (`dropSets`, totals) count distinct `set_number`.
  Records and progression ignore drop sets, as today.
- Existing data needs no backfill: old `drop` rows have `drop_index = 0` and keep showing as
  separate sets.

Interface:

- Marking a set **Drop set (D)** shows a **+ Bajada** button under it. Each drop is an indented
  sub-row (`↳ 60 kg × 6 ✓`) under the parent row, with the same inputs and a swipe to delete.
- A new drop pre-fills weight = previous drop − 25 %, rounded to the exercise's weight step, and
  the previous reps. The user can edit both.
- Ticking a drop does not start the rest timer. The timer starts when the last drop of the set
  is ticked, i.e. no further drop is pending under it.
- History and the finished-workout summary show the set as one line: `D 80×8 → 60×6 → 40×5`.
- Changing the set type away from drop with drops present asks to confirm and deletes the drops.

## Alternatives considered

- **JSON `drops` column on the parent row.** Rejected: volume, sync (`upsert-set`) and history SQL
  would have to parse JSON; a drop could not be ticked or synced on its own.
- **Separate `set_drops` table.** Rejected: duplicates the weight/reps/completed columns and the
  offline sync path for no gain over a column on the same table.
- **Keep separate rows, only group them in the UI.** Rejected: the grouping would be guessed from
  row order, and the rest timer and counts stay wrong.

## Consequences

- One migration; removing the feature later needs a migration back and merging drops into rows.
- Offline queue and `upsert-set` payloads carry `dropIndex`; old app versions ignore drop rows
  they do not know, so the app and API must ship together (pnpm release).
- Default 25 % drop is a guess to tune with users.

## Log

- 2026-11-07 proposed following user feedback that drop sets cannot start heavy and go down.
- 2026-11-07 accepted by @alefrank; a second drop set is a new set with its own drops. Built uncommitted: migration 0029, API, offline client, exercise screen; not yet verified on a device.
