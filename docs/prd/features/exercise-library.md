# Feature — Exercise Library

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- Context: [architecture/contexts/exercise-library/readme.md](../../architecture/contexts/exercise-library/readme.md)
- Database: [database-schema.md → Exercise Library Seed](../../architecture/database-schema.md#exercise-library-seed)
- Decisions: [ADR-017](../../architecture/decisions/017-exercise-catalog.md), [ADR-016](../../architecture/decisions/016-workout-data-model-v2.md)
- Stories: [Round 7](../../stories/phase-2/round-7/readme.md)

Phase 2. A Hevy-style exercise catalog: 100+ system exercises with muscles, equipment, type and instructions, plus custom exercises. It feeds the exercise picker, the routine builder, progression increments and muscle stats.

---

## Functional Requirements

### Browse

#### FR-EL-001

`/exercises` lists every system exercise plus the user's own custom exercises (non-archived), alphabetically. Each row shows the name, primary muscle, equipment and a "Personalizado" tag for custom ones.

#### FR-EL-002

Search by name: case- and accent-insensitive substring match, updated as the user types (debounce 150 ms). Filters by **primary muscle** (multi-select, `MuscleGroups`) and **equipment** (multi-select). Filters combine with AND across groups and OR within a group.

#### FR-EL-003

`/exercises/[id]` exercise detail with tabs:

| Tab | Content | Source |
|---|---|---|
| Cómo hacerlo | Primary/secondary muscles, equipment, type, numbered instructions, "Ver video" external link | this feature |
| Historial | The user's sessions with this exercise, newest first, with sets | [FR-PR-013](./progress.md#fr-pr-013) |
| Gráficas | Charts for this exercise | [FR-PR-012](./progress.md#fr-pr-012) |
| Récords | Records and the rep-max table | [FR-PR-011](./progress.md#fr-pr-011) |

#### FR-EL-004

The list and the picker show a **Recientes** section first: up to 8 exercises the user logged most recently.

### Picker

#### FR-EL-005

Exercise picker (bottom sheet on mobile, modal on desktop). It is used by the live workout ([FR-WT-021](./workout-tracking.md#fr-wt-021), [FR-WT-024](./workout-tracking.md#fr-wt-024)) and the routine builder ([FR-RT-007](./routines.md#fr-rt-007)).

- Search and filters as in FR-EL-002, plus the Recientes section.
- **Multi-select** with a numbered order badge. The *Añadir (N)* button returns the IDs in selection order.
- *Replace* mode allows a single selection.
- Includes system exercises and the user's own custom ones only ([ADR-017 §1](../../architecture/decisions/017-exercise-catalog.md)).
- *+ Crear ejercicio* opens FR-EL-006 inline and returns the new exercise selected.

### Custom Exercises

#### FR-EL-006

Create a custom exercise:

| Field | Rule |
|---|---|
| name | required, 2–60 characters, trimmed, unique among my custom exercises (case-insensitive). It may not equal a system exercise name ("Ya existe en la biblioteca") |
| primary muscle | required (`MuscleGroups`) |
| secondary muscles | 0–3, different from the primary |
| equipment | required |
| exercise type | required ([ADR-016 §3](../../architecture/decisions/016-workout-data-model-v2.md)) |
| instructions | optional, ≤ 2000 characters |
| video URL | optional, `https://` only |

#### FR-EL-007

The owner can edit a custom exercise. `exercise_type` is **locked** once any set references the exercise, because changing it would invalidate logged metrics.

#### FR-EL-008

The owner can archive a custom exercise. It disappears from the list and the picker but remains in history, routines already using it, stats and records. It can be restored from "Archivados".

#### FR-EL-009

Other family members see my custom exercises' names and details wherever my workouts appear (feed, member profile), but they cannot add them to their own routines or workouts.

### Catalog Content

#### FR-EL-010

The system catalog has ≥ 100 exercises covering every `MuscleGroups` value except `neck` and `other`. It includes cardio exercises. Every system exercise has 2–6 instruction steps. The 32 Phase 1 exercises keep their IDs and names and receive metadata per the legacy mapping ([ADR-017 §3](../../architecture/decisions/017-exercise-catalog.md)).

#### FR-EL-011

Exercise names are in English ([OQ-001](../../planning/open-questions.md)). Muscle and equipment **labels** are shown in Spanish:

| Value | Label |
|---|---|
| `abdominals` | Abdominales |
| `abductors` | Abductores |
| `adductors` | Aductores |
| `biceps` | Bíceps |
| `calves` | Gemelos |
| `cardio` | Cardio |
| `chest` | Pecho |
| `forearms` | Antebrazos |
| `full_body` | Cuerpo completo |
| `glutes` | Glúteos |
| `hamstrings` | Isquiotibiales |
| `lats` | Dorsales |
| `lower_back` | Lumbar |
| `neck` | Cuello |
| `quadriceps` | Cuádriceps |
| `shoulders` | Hombros |
| `traps` | Trapecios |
| `triceps` | Tríceps |
| `upper_back` | Espalda alta |
| `other` | Otro |

| Equipment | Label |
|---|---|
| `barbell` | Barra |
| `dumbbell` | Mancuernas |
| `machine` | Máquina |
| `cable` | Polea |
| `kettlebell` | Kettlebell |
| `bodyweight` | Peso corporal |
| `band` | Banda |
| `plate` | Disco |
| `smith_machine` | Multipower |
| `other` | Otro |

---

## Non-Functional Requirements

#### NFR-EL-01

The picker opens in < 300 ms and filters in < 50 ms per keystroke. The full catalog (~110 rows) is loaded once per session and filtered client-side, cached by the service worker ([ADR-025](../../architecture/decisions/025-offline-live-workout.md)).

---

## Data

| Table | Access |
|-------|--------|
| `exercises` | Read all. Insert/update own custom rows (`owner_id = me`). No delete |

## Components

| Component | Spec |
|-----------|------|
| `ExercisePicker` | [components.md → Exercise Library](../../architecture/components.md#exercise-library) |
| `ExerciseListItem`, `ExerciseFilters` | [components.md → Exercise Library](../../architecture/components.md#exercise-library) |
| `CustomExerciseForm` | [components.md → Exercise Library](../../architecture/components.md#exercise-library) |
