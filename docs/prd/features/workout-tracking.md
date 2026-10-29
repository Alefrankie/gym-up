# Feature — Workout Tracking

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- System: [architecture/system.md](../../architecture/system.md)
- Database: [architecture/database-schema.md](../../architecture/database-schema.md)
- Components: [architecture/components.md](../../architecture/components.md)
- Decisions: [ADR-001](../../architecture/decisions/001-supabase-client-side.md), [ADR-003](../../architecture/decisions/003-routines-seed-data.md) (superseded), [ADR-006](../../architecture/decisions/006-kg-storage.md)
- Phase 2 decisions: [ADR-015](../../architecture/decisions/015-live-workout-react-island.md), [ADR-016](../../architecture/decisions/016-workout-data-model-v2.md), [ADR-025](../../architecture/decisions/025-offline-live-workout.md)
- Phase 2 stories: [Round 9 — Live Workout v2](../../stories/phase-2/round-9/readme.md), [Round 12 — Platform](../../stories/phase-2/round-12/readme.md)

Core workout loop: register → pick routine → daily workout → log exercises → complete → history.

**Phase 2** turns the loop into a Hevy-style live session: start any routine or an empty workout, edit exercises on the fly, set types, RPE, per-exercise rest timers, "Previous" values, progression suggestions, PR badges, offline logging. Phase 1 requirements stay valid unless marked **Superseded**.

---

## Functional Requirements

### Auth & Onboarding

#### FR-WT-001

User can register with email, password, display name, routine type (hombre/mujer), weight unit (kg/lbs).

#### FR-WT-002

User can login with email/password. Supabase Auth handles credential management.

#### FR-WT-003

Profile auto-created on registration via DB trigger. Per [database-schema.md](../../architecture/database-schema.md) `handle_new_user()`.

#### FR-WT-004

If already logged in, redirect to dashboard.

### Daily Workout

#### FR-WT-005

> **Superseded by [FR-RT-010](./routines.md#fr-rt-010)** (rotation, [ADR-019](../../architecture/decisions/019-rotation-scheduling-and-onboarding.md)).

Dashboard shows today's workout based on weekday (1=Mon, 5=Fri). Maps to `routine_days.day_number` for user's routine.

#### FR-WT-006

User can start a workout, creating a `workouts` record (`status: 'in_progress'`).

#### FR-WT-007

Each exercise shows target sets/reps from `routine_exercises`. Routines stored as seed data per [ADR-003](../../architecture/decisions/003-routines-seed-data.md).

#### FR-WT-008

User logs actual sets, reps, weight per exercise. One `workout_entries` row per set.

#### FR-WT-009

Weight input shows unit label (kg or lbs) per user preference. Stored in kg internally per [ADR-006](../../architecture/decisions/006-kg-storage.md).

#### FR-WT-010

Optional free-text notes per exercise set. `notes` column on `workout_entries`.

#### FR-WT-011

> **Superseded by [FR-WT-034](#fr-wt-034)** (per-exercise rest timer).

Rest timer starts on set completion. 90s default, +30s extend, skip. Client-side only, no DB persistence. Per [components.md](../../architecture/components.md) `RestTimer`.

#### FR-WT-012

> **Superseded by [FR-WT-035](#fr-wt-035) and [FR-WT-036](#fr-wt-036)** (finish flow + summary v2).

User can complete workout → summary shown (exercises, sets, volume, duration). Status updated to `completed`.

#### FR-WT-013

Partial workouts saved as `in_progress`, resumable later.

#### FR-WT-014

> **Superseded by [FR-RT-012](./routines.md#fr-rt-012)** (no rest-day screen; pick any routine or an empty workout).

Weekend shows "Rest day" with option to manually pick a day.

#### FR-WT-015

Cardio reminder displayed: "Warmup: 5-10 min walk", "Cooldown: 15-30 min walk". Not tracked.

### Settings

#### FR-WT-016

> Routine-type switch **superseded by [FR-RT-004](./routines.md#fr-rt-004)** (active program). Display name and unit remain.

User can update display name, switch routine type, toggle weight unit (kg/lbs). Routine type change doesn't affect past workouts.

#### FR-WT-017

User can logout.

---

## Phase 2 — Functional Requirements

Data model: [ADR-016](../../architecture/decisions/016-workout-data-model-v2.md). Island architecture: [ADR-015](../../architecture/decisions/015-live-workout-react-island.md). UI copy is Spanish; exercise names are English ([OQ-001](../../planning/open-questions.md)).

### Starting a Workout

#### FR-WT-018

User can start a workout in four ways:

1. **Next routine** of the active program (dashboard primary button, [FR-RT-011](./routines.md#fr-rt-011)).
2. **Any routine** of any of their programs ("Elegir otra rutina").
3. **Empty workout** ("Entrenamiento libre"). `routine_day_id = NULL`, name "Entrenamiento libre".
4. **Repeat a past workout** from its detail page ("Repetir"). The new workout copies the exercise list, order, supersets and set count with no values. It stays linked to the source's `routine_day_id` if it has one.

Starting creates the `workouts` row, plus one `workout_exercises` row per routine exercise and `target_sets` (+ `warmup_sets`) empty set rows. All IDs are client-generated ([ADR-025](../../architecture/decisions/025-offline-live-workout.md)).

#### FR-WT-019

At most **one** `in_progress` workout per user. While one exists:

- The dashboard and every page show a sticky banner "Entrenamiento en curso · 00:42:10 · Continuar".
- Trying to start another workout asks: **Continuar el actual** / **Descartar y empezar nuevo**.

#### FR-WT-020

The live workout header shows an editable workout name, an elapsed timer (`now − started_at`, updating every second), running **volume** (Σ weight × reps of completed sets, in the user's unit), and **completed sets** count. A *Terminar* button sits top-right.

### Exercises in a Session

#### FR-WT-021

User can add one or more exercises at any time through the exercise picker ([FR-EL-005](./exercise-library.md#fr-el-005)). Added exercises go to the end, each with one empty set.

#### FR-WT-022

User can remove an exercise. If it has ≥ 1 completed set, a confirmation is required ("Se borrarán N series").

#### FR-WT-023

User can reorder exercises with a drag handle, plus accessible *Subir/Bajar* menu items. Order persists as `workout_exercises.position`.

#### FR-WT-024

User can **replace** an exercise with another from the picker. If both share `exercise_type`, set values are kept; otherwise sets are cleared after confirmation. Hevy behaviour.

#### FR-WT-025

User can create a **superset** by linking an exercise with the next one(s): menu → *Superserie con…*. Exercises in a superset share a colored bar and a letter label (A1, A2). The rest timer starts only after a set of the **last** exercise in the superset round.

#### FR-WT-026

Each exercise has a notes field for this session (`workout_exercises.notes`). If the routine exercise has notes, they show read-only above it as "Nota de la rutina".

### Sets

#### FR-WT-027

Set row inputs depend on `exercises.exercise_type` ([ADR-016 §3](../../architecture/decisions/016-workout-data-model-v2.md)):

| Type | Columns |
|---|---|
| `weight_reps` | Peso · Reps |
| `bodyweight_reps` | Reps |
| `weighted_bodyweight` | +Peso · Reps |
| `assisted_bodyweight` | −Peso (asistencia) · Reps |
| `duration` | Tiempo (mm:ss) |
| `distance_duration` | Distancia (km or mi) · Tiempo |
| `weight_distance` | Peso · Distancia (m or yd) |

#### FR-WT-028

Tapping the set number opens the set-type menu: **Normal**, **Calentamiento (W)**, **Drop set (D)**, **Al fallo (F)**. Labels follow [ADR-016 §4](../../architecture/decisions/016-workout-data-model-v2.md).

#### FR-WT-029

Each row shows an **Anterior** column: the value of the same-position set of the same exercise in the user's most recent completed workout containing it (e.g. "60 kg × 10"). If that workout had fewer sets, the last one is used. Tapping *Anterior* copies its values into the row.

#### FR-WT-030

Row prefill priority when a workout starts:

1. Progression suggestion ([FR-PG-001](./progression.md#fr-pg-001)) when progression is enabled;
2. otherwise the *Anterior* values;
3. otherwise empty, with the routine's rep range as a placeholder ("8–12").

Prefilled values render in a muted style until the user edits them or checks the set.

#### FR-WT-031

When `profiles.rpe_enabled`, each row has an RPE selector (6, 6.5 … 10). It is optional per set.

#### FR-WT-032

*+ Añadir serie* copies the last set's values and type. A set can be deleted with a swipe or the row menu. Max `MaxSetsPerExercise` (20).

#### FR-WT-033

Checking a set validates the required metrics for its type. Invalid sets are shaken and highlighted, and not checked. A valid check sets `completed = true` and `completed_at = now`, starts the rest timer ([FR-WT-034](#fr-wt-034)) and runs PR detection ([FR-PR-009](./progress.md#fr-pr-009)). Unchecking reverts `completed` and clears `completed_at`.

### Rest Timer

#### FR-WT-034

Rest time per exercise comes from `routine_exercises.rest_seconds`, else `profiles.default_rest_seconds` (default 90). `0` means off. On set check:

- a sticky bottom bar shows the countdown, **−15 s / +15 s**, and *Saltar*;
- editing the value in the bar updates the exercise's rest for the rest of the session;
- at 0 the phone vibrates (when supported), a short sound plays, and a Web Notification is sent if permission was granted (asked once, at the first timer);
- the timer is computed from an absolute end timestamp, so it stays correct after the screen locks or the tab sleeps.

### Finishing

#### FR-WT-035

*Terminar*:

- Sets with values but not checked → dialog "Tienes N series sin marcar": **Marcarlas como hechas** / **Descartarlas**.
- Sets with no values are discarded silently.
- Requires ≥ 1 completed set (Phase 1 rule kept). Otherwise "Registra al menos una serie" plus a *Descartar entrenamiento* option.
- If elapsed time > 3 h → "¿Olvidaste terminar?" with an editable end time.

#### FR-WT-036

The summary screen (v2) shows duration, volume, completed sets, **PRs** (list with type and value), sets per muscle (top 5), and the comparison with the previous workout of the same routine (volume Δ %). Name and notes are editable. Actions:

- *Añadir foto* ([FR-PP-003](./private-photos.md#fr-pp-003));
- *Compartir* ([FR-SO-008](./social.md#fr-so-008));
- *Guardar como rutina* ([FR-RT-018](./routines.md#fr-rt-018));
- *Listo* → dashboard.

### Settings (v2)

#### FR-WT-037

Settings → *Entrenamiento* (the last three toggles are shown in their own *Progresión* section of the same page; see the [user context](../../architecture/contexts/user/readme.md)):

| Setting | Column | Default |
|---|---|---|
| Unidad de peso | `weight_unit` | kg |
| Descanso por defecto | `default_rest_seconds` | 90 |
| Peso de la barra | `bar_weight_kg` | 20 kg (45 lb shown for lbs users) |
| Discos disponibles | `available_plates_kg` | kg: 25, 20, 15, 10, 5, 2.5, 1.25 · lbs: 45, 35, 25, 10, 5, 2.5 |
| Registrar RPE | `rpe_enabled` | off |
| Sugerencias de progresión | `progression_enabled` | on |
| Check-in de energía | `readiness_enabled` | on |

### Discard, Edit, Delete

#### FR-WT-038

*Descartar entrenamiento* (header menu) deletes the in-progress workout and all its rows, after confirmation.

#### FR-WT-039

A completed workout can be **edited** from its detail page ("Editar"). This opens the same island in edit mode: exercises, sets, name, notes, start date/time and duration. It can also be **deleted** after confirmation. Records and stats re-derive automatically ([ADR-020 §4](../../architecture/decisions/020-personal-records.md)).

### Gym Tools

#### FR-WT-040

**Plate calculator.** For `barbell` / `smith_machine` exercises, a 🏋 button next to the weight input opens a sheet showing the plates per side for that weight, from `bar_weight_kg` and `available_plates_kg` (greedy, largest first). If the weight is not loadable, it shows the nearest lower and upper loadable weights.

#### FR-WT-041

**Warm-up generator.** In the exercise menu, *Añadir calentamiento* inserts warm-up sets before the first working set: 40 % × 10, 60 % × 5, 80 % × 3 of the first working set's weight, rounded to loadable weights, skipping any warm-up below the empty bar. Hevy's warm-up calculator.

#### FR-WT-042

**1RM calculator.** Profile → *Herramientas* → *Calculadora 1RM*: weight + reps → e1RM (Epley, [ADR-020](../../architecture/decisions/020-personal-records.md)) plus a table of 50–95 % in 5 % steps, with reps ranges.

### Cardio

#### FR-WT-043

Cardio is logged as exercises of type `duration` / `distance_duration` (Treadmill, Running, Walking, Stationary Bike, Elliptical, Rowing Machine, Stair Climber, Jump Rope, Cycling — [FR-EL-010](./exercise-library.md#fr-el-010)). They can be added to any workout, or used alone in an empty workout. The FR-WT-015 reminders remain as hints on routines that contain no cardio exercise.

### App Shell

#### FR-WT-044

**Navigation v2** — bottom tab bar on mobile, top bar on desktop ([components.md → Navigation v2](../../architecture/components.md#navigation-v2)):

| Tab | Route | Content |
|---|---|---|
| Inicio | `/dashboard` | Next workout, readiness/recovery, deload card, family feed |
| Entrenar | `/train` | Programs & routines, empty workout, exercise library |
| Progreso | `/progress` | Stats, records, calendar, AI summary |
| Perfil | `/profile` | Me: history, body metrics, photos, nutrition, tools, settings |

The in-progress banner ([FR-WT-019](#fr-wt-019)) sits above the tab bar.

#### FR-WT-045

`/profile` hub shows display name, total workouts, weekly streak ([FR-PR-017](./progress.md#fr-pr-017)) and links: Historial, Medidas, Fotos, Nutrición, Herramientas, Exportar datos, Ajustes, Cerrar sesión.

---

## Phase 2 — Non-Functional Requirements

#### NFR-WT-P2-01

The live workout keeps working offline once loaded (log, edit, finish), and syncs automatically when back online ([ADR-025](../../architecture/decisions/025-offline-live-workout.md)).

#### NFR-WT-P2-02

Checking a set updates the UI in < 100 ms. Network sync never blocks input.

#### NFR-WT-P2-03

No logged set is lost on reload, tab kill, or a phone restart during a workout. The reducer snapshot and outbox are persisted on every action.

#### NFR-WT-P2-04

The live workout is usable one-handed at 360 px width. Tap targets ≥ 44 px. Number inputs use `inputmode="decimal"` / `"numeric"`.

#### NFR-WT-P2-05

The app is installable as a PWA (manifest + service worker) on Android Chrome and iOS Safari.

---

## Data

| Table | Access |
|-------|--------|
| `profiles` | Read all, write own (Phase 2 adds settings columns) |
| `routines` | Templates read all; user programs read all, write own ([ADR-018](../../architecture/decisions/018-user-owned-programs.md)) |
| `routine_days` | Same as `routines` |
| `routine_exercises` | Same as `routines` |
| `exercises` | Read all; custom rows write own ([ADR-017](../../architecture/decisions/017-exercise-catalog.md)) |
| `workouts` | Read all, write own |
| `workout_exercises` | Read all, write own via workout ownership (Phase 2) |
| `workout_entries` | Read all, write own via workout ownership |

Full SQL: [database-schema.md](../../architecture/database-schema.md)

## Components

| Component | Spec |
|-----------|------|
| `ExerciseCard` | [components.md](../../architecture/components.md) — retired in Phase 2 ([ADR-015](../../architecture/decisions/015-live-workout-react-island.md)) |
| `WorkoutSummary` | [components.md](../../architecture/components.md) — v2 in Phase 2 |
| `RestTimer` | [components.md](../../architecture/components.md) — becomes `use-rest-timer` + `RestTimerBar` |
| `AuthForm` | [components.md](../../architecture/components.md) |
| `Navigation` | [components.md](../../architecture/components.md) — Navigation v2 |
| `LiveWorkout` and children | [components.md → Live Workout](../../architecture/components.md#live-workout) |
| `PlateCalculatorSheet`, `OneRmCalculator` | [components.md → Gym Tools](../../architecture/components.md#gym-tools) |
