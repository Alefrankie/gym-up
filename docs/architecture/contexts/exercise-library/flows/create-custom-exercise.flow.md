# Create Custom Exercise Flow

Parent: [../readme.md](../readme.md) · PRD: [../../../../prd/features/exercise-library.md](../../../../prd/features/exercise-library.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Phase | 2 |
| Last edited | 2026-10-01 |
| Requirements | FR-EL-006, FR-EL-007, FR-EL-008, FR-EL-009 |
| Stories | [7.4](../../../../stories/phase-2/round-7/story-7.4.md) |

## Happy Path

### Step 1 - Open the form

Entry points: *+ Crear ejercicio* on `/exercises` (→ `/exercises/new`), *Crear «query»* from an empty search (→ `/exercises/new?name=query`), or inline in the picker ([pick-exercises flow](./pick-exercises.flow.md)). All render `CustomExerciseForm`.

### Step 2 - Fill the fields

| Field | Control | Rule (FR-EL-006, `CustomExerciseRules`) |
|---|---|---|
| Nombre | text | Required, 2–60 characters after trim |
| Músculo principal | select (`MuscleGroupLabels`) | Required |
| Músculos secundarios | multi-select | 0–3; the primary is not offered |
| Equipo | select (`EquipmentLabels`) | Required |
| Tipo | select (`ExerciseTypeLabels`) | Required. Helper text lists the inputs the type logs, from `ExerciseTypeMetricRules` |
| Instrucciones | textarea | Optional, ≤ 2000 characters, Markdown |
| Vídeo | url | Optional, `https://` only |

The form validates on blur with `validateCustomExercise` (the same pure function the server uses) and shows field messages in Spanish. *Guardar* is disabled while a field is invalid.

### Step 3 - Submit

*Guardar* → `POST /api/exercises` → `CreateCustomExerciseUseCase`: trim, validate, system-name check, own-name check, insert with `ownerId = userId`.

### Step 4 - Result

`201 { exercise }`. From `/exercises/new` the user lands on `/exercises/[id]` with the toast "Ejercicio creado". From the picker, the exercise is selected (pick-exercises flow, inline create). The in-memory catalog is updated; the next `GET /api/exercises` revalidates the service-worker copy.

---

## Failure: Name matches a system exercise

`DuplicateExerciseNameError('system')` → 409 → field message "Ya existe en la biblioteca". The comparison ignores case and surrounding spaces ("bench press" equals "Bench Press").

## Failure: Name matches one of my exercises

Scope `own` → "Ya tienes un ejercicio con ese nombre". Scope `own_archived` → "Ya tienes un ejercicio archivado con ese nombre" with a link to *Archivados*. Archived names stay reserved because the unique index covers archived rows.

## Failure: Invalid fields

`CustomExerciseValidationError` → 400 with `issues: [{ field, code }]`. The form maps each code to its field message. This only happens when the client check was bypassed.

## Failure: Offline

Submitting offline fails before the request with "Necesitas conexión para crear ejercicios". Nothing is queued.

## Edge Case: Edit

The owner opens `/exercises/[id]/edit` (*Editar* on the detail page) → `GET /api/exercises/[id]` → the same form, prefilled → `PATCH /api/exercises/[id]` → `UpdateCustomExerciseUseCase`. When `isTypeLocked` (a `workout_exercises` or `workout_entries` row uses the exercise), the *Tipo* select is disabled with "No se puede cambiar el tipo porque ya tiene series registradas" (FR-EL-007). A forced change returns 409 `type_locked`. Renames show everywhere, history included, because history references the ID.

## Edge Case: Archive

*Archivar* on the detail page (owner only) asks "¿Archivar ejercicio? Seguirá en tu historial y en las rutinas que ya lo usan." → `POST /api/exercises/[id]/archive`. The exercise disappears from `/exercises`, the picker and Recientes, and stays in history, routines, stats and records (FR-EL-008). Archiving twice is a no-op.

## Edge Case: Restore

`/exercises?archived=1` → *Restaurar* → `POST /api/exercises/[id]/restore`. The exercise reappears in the list and the picker. Its name cannot collide, because it stayed reserved while archived.

## Edge Case: Not the owner

A family member opening my custom exercise sees no *Editar*/*Archivar* actions. Direct calls to `PATCH`, `archive` or `restore` return 403 (`ExerciseOwnershipError`); on system exercises, 403 (`SystemExerciseImmutableError`). In Supabase mode, RLS `exercises_update_own` also blocks the write.

## Edge Case: Visibility to the family

After creation, siblings see the exercise's name and details where my workouts appear (feed, member profile), but it never appears in their list or picker (FR-EL-009).
