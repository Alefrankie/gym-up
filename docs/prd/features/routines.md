# Feature — Programs & Routines

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- Context: [architecture/contexts/routines/readme.md](../../architecture/contexts/routines/readme.md)
- Database: [database-schema.md → Program Templates Seed](../../architecture/database-schema.md#program-templates-seed)
- Decisions: [ADR-018](../../architecture/decisions/018-user-owned-programs.md), [ADR-019](../../architecture/decisions/019-rotation-scheduling-and-onboarding.md)
- Stories: [Round 8](../../stories/phase-2/round-8/readme.md)

Phase 2. A Hevy-style routine builder plus Gravl-style "your next workout" and program recommendation. The Phase 1 fixed `hombre`/`mujer` routines become two of seven templates.

Vocabulary ([ADR-018 §1](../../architecture/decisions/018-user-owned-programs.md)): **Program** = `routines` row, **Routine** = `routine_days` row.

---

## Functional Requirements

### Programs

#### FR-RT-001

`/train` lists:

- **Mis programas**: the user's non-archived programs, with the active one first and marked "Activo";
- an **Explorar plantillas** entry ([FR-RT-017](#fr-rt-017));
- quick actions *Entrenamiento libre* and *Biblioteca de ejercicios*.

#### FR-RT-002

Create a program: name (1–60 characters, required), optional description (≤ 500). It starts with zero routines.

#### FR-RT-003

Edit a program's name and description, archive it, restore it, or delete it. Delete is allowed only when no workout references any of its routines; otherwise the UI offers **Archivar**. The active program cannot be archived or deleted.

#### FR-RT-004

Set any program as **active** (`profiles.active_program_id`). This restarts the rotation ([FR-RT-013](#fr-rt-013)).

#### FR-RT-005

**Adopt a template**: deep copy into a user program ([ADR-018 §2](../../architecture/decisions/018-user-owned-programs.md)), with the option "Activar ahora" (checked by default).

#### FR-RT-006

**Copy a family member's program or routine**. From a sibling's workout detail ([FR-SO-009](./social.md#fr-so-009)) or profile: *Guardar rutina* copies that routine into a chosen program of mine (or a new program "Copiadas"). *Guardar programa* copies the whole program.

### Routines

#### FR-RT-007

Routine builder (`/train/routines/[id]/edit`, or new):

- name (1–60), optional notes (≤ 500);
- exercises added through the picker ([FR-EL-005](./exercise-library.md#fr-el-005));
- *Guardar* / *Cancelar*. Leaving with unsaved changes asks for confirmation.

#### FR-RT-008

Per routine exercise:

| Field | Rule | Default |
|---|---|---|
| Series objetivo | 1–20 | 3 |
| Rango de reps | 1 ≤ min ≤ max ≤ 100 (duration types: seconds range; distance types: hidden) | 8–12 |
| Series de calentamiento | 0–5 | 0 |
| Descanso | 0–600 s in 15 s steps, or "Por defecto" | Por defecto |
| RPE objetivo | optional 6–10 | — |
| Superserie | link with the next exercise | — |
| Nota | ≤ 300 characters | — |

#### FR-RT-009

Reorder routines inside a program (rotation order = `day_number`). Reorder exercises inside a routine. **Duplicate** a routine. Delete a routine (same rule as FR-RT-003: delete only when no workout references it, otherwise archive). Limits come from [ADR-018 §5](../../architecture/decisions/018-user-owned-programs.md).

### Next Workout (Rotation)

#### FR-RT-010

The **next routine** is computed by rotation over the active program ([ADR-019 §1](../../architecture/decisions/019-rotation-scheduling-and-onboarding.md)). It is never tied to the weekday.

#### FR-RT-011

The dashboard's **Siguiente entrenamiento** card shows the routine name, the program name, the exercise list (name + sets × rep range), an estimated duration (Σ sets × (40 s + rest) + 5 min, rounded to 5 min), readiness and recovery hints ([FR-PG-011](./progression.md#fr-pg-011)) and the *Empezar* button.

#### FR-RT-012

Below it: *Elegir otra rutina* lists every routine of the active program with "hecha hace N días" and a fatigue marker, plus *Entrenamiento libre*. There is no rest-day screen (supersedes FR-WT-014).

#### FR-RT-013

Changing the active program, or editing the order of routines, restarts the rotation from the first routine. Past workouts are not changed.

#### FR-RT-014

A user with no active program sees an onboarding card "Elige tu programa" instead of the next-workout card, plus *Entrenamiento libre*.

### Onboarding & Recommendation

#### FR-RT-015

Onboarding questionnaire ([ADR-019 §2](../../architecture/decisions/019-rotation-scheduling-and-onboarding.md)): 5 single-choice steps (goal, experience, days/week, equipment, focus), with progress dots, back/next, and ≤ 30 s total. It is shown:

- after registration;
- on first login of a Phase 1 user (migrated users already have an adopted program; the questionnaire offers "Mantener mi programa actual");
- from Ajustes → *Cambiar programa*.

#### FR-RT-016

The result screen shows the **recommended** template, with a reason sentence built from the matched criteria (e.g. "3 días · mancuernas · principiante"), plus 2 alternatives and *Ver todas las plantillas*. Choosing one runs FR-RT-005 with activation.

### Templates

#### FR-RT-017

`/train/templates` lists the 7 seeded templates ([database-schema.md](../../architecture/database-schema.md#program-templates-seed)) with level, goal, days/week and equipment chips. A preview shows routines and exercises. *Usar plantilla* = FR-RT-005.

### Save Workout as Routine

#### FR-RT-018

From a completed workout (summary or detail), *Guardar como rutina* creates a routine with the workout's exercises, order, supersets and notes. Target sets = the number of completed working sets. The rep range is derived from the logged reps (`[min, max]`, widened to at least 2 apart). Destination is a program the user chooses or a new program.

---

## Data

| Table | Access |
|-------|--------|
| `routines` | Templates (`owner_id IS NULL`): read all. User programs: read all, write own |
| `routine_days` | Via parent program |
| `routine_exercises` | Via parent program |
| `profiles` | `active_program_id`, onboarding answers: write own |

## Components

| Component | Spec |
|-----------|------|
| `ProgramList`, `ProgramCard` | [components.md → Programs & Routines](../../architecture/components.md#programs--routines) |
| `RoutineBuilder` (React island) | [components.md → Programs & Routines](../../architecture/components.md#programs--routines) |
| `NextWorkoutCard` | [components.md → Programs & Routines](../../architecture/components.md#programs--routines) |
| `OnboardingWizard` (React island) | [components.md → Programs & Routines](../../architecture/components.md#programs--routines) |
