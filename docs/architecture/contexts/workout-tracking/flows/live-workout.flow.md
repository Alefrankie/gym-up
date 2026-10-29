# Live Workout Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md#phase-2](../readme.md#phase-2) · PRD: [FR-WT-018 … FR-WT-034](../../../../prd/features/workout-tracking.md#phase-2--functional-requirements)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Stories | [9.1](../../../../stories/phase-2/round-9/story-9.1.md), [9.2](../../../../stories/phase-2/round-9/story-9.2.md), [12.3](../../../../stories/phase-2/round-12/story-12.3.md) |
| Decisions | [ADR-015](../../../decisions/015-live-workout-react-island.md), [ADR-016](../../../decisions/016-workout-data-model-v2.md), [ADR-025](../../../decisions/025-offline-live-workout.md) |

Replaces [start-workout.flow.md](./start-workout.flow.md) and [log-set.flow.md](./log-set.flow.md). Use case, action and command names are defined in the [context readme → Phase 2](../readme.md#phase-2).

## Happy Path

### Step 1 - Dashboard shows the next routine

User opens `/dashboard`. SSR loads the next routine of the active program (routines context, [ADR-019](../../../decisions/019-rotation-scheduling-and-onboarding.md)) and calls `GetActiveWorkoutUseCase`. No workout is in progress, so `NextWorkoutCard` shows "Siguiente: Push A" with *Empezar*, plus *Elegir otra rutina* and *Entrenamiento libre* ([FR-RT-011](../../../../prd/features/routines.md#fr-rt-011)). The card's JSON prop contains the routine plan, previous values and suggestions. From story 12.3 the service worker caches the page.

### Step 2 - Start

User taps *Empezar*. `NextWorkoutCard` generates `workoutId = crypto.randomUUID()`, builds the skeleton with `buildWorkoutSkeleton({ kind: 'plan', plan })` (client UUIDs for every exercise and set), enqueues `start-workout` and navigates to `/workout/[id]`.

Server: `PUT /api/workouts/[id]` → `StartWorkoutUseCase`:

- checks the one-in-progress rule;
- validates the plan's owner and the exercises (`RoutinePlanPort`, `ExerciseCatalogPort`);
- sets `isDeload` (`SuggestionPort.isDeloadActive`), `name = "Push A"` and `workoutDate`;
- inserts the workout, its `workout_exercises` and the empty sets in one transaction (`createFromSkeleton`);
- returns `201`.

For *Elegir otra rutina* and *Entrenamiento libre* the card sends no skeleton, and the server builds it with the same function ([FR-WT-018](../../../../prd/features/workout-tracking.md#fr-wt-018)).

### Step 3 - Island loads

`/workout/[id]` SSR calls `GetLiveWorkoutStateUseCase` (`mode: 'live'`) and mounts `LiveWorkout` with `client:load`. The reducer runs `state/initialized`:

- each set row gets its prefill: suggestion, else *Anterior*, else the "8–12" placeholder ([FR-WT-030](../../../../prd/features/workout-tracking.md#fr-wt-030));
- the header shows the name, the elapsed clock (`now − startedAt`), volume 0 and 0 sets ([FR-WT-020](../../../../prd/features/workout-tracking.md#fr-wt-020)).

### Step 4 - Readiness (optional)

If `showReadinessStep` (`readiness_enabled`, no check-in yet, no completed set), `ReadinessStep` asks the three 1–5 questions and lists fatigued muscles ([FR-PG-009](../../../../prd/features/progression.md#fr-pg-009)). On submit it calls `POST /api/progression/readiness` (progression writes the check-in and `workouts.readiness_score`) and dispatches `readiness/submitted` with the adjusted suggestions; untouched rows get a new prefill and the header shows "Sesión ajustada: −1 serie" when it applies ([FR-PG-010](../../../../prd/features/progression.md#fr-pg-010)). *Saltar* dispatches `readiness/skipped`. Offline, the step is skipped. Decision: offline skip, because the check-in endpoint is online-only (simplest).

### Step 5 - Log a set

User edits the weight of set 1 (`set/changed`) and taps ✓ (`set/checked`):

- `validateSetMetrics` passes for `weight_reps`;
- the set becomes `completed` with `completedAt = at`;
- `detectPrs` compares it with the baseline; a beaten record shows 🏆 ([FR-PR-009](../../../../prd/features/progress.md#fr-pr-009));
- `toCommands` emits one `upsert-set`, which `use-live-workout` enqueues;
- the UI updates in < 100 ms. The sync worker sends `PUT /api/workout-sets/[id]` in the background (`UpsertSetUseCase` → `created`).

### Step 6 - Rest timer

The exercise has `restSeconds = 120`, so the reducer sets `restTimer.endsAt = at + 120 000`. `RestTimerBar` (through `use-rest-timer`) shows the countdown with −15 s / +15 s / *Saltar*. Editing the value in the bar dispatches `exercise/rest-changed` (→ `update-exercise`). At 0 the phone vibrates, a sound plays, a notification fires if permission was granted, and `timer/finished` clears the bar ([FR-WT-034](../../../../prd/features/workout-tracking.md#fr-wt-034)).

### Step 7 - Add an exercise and make a superset

User taps *Añadir ejercicio* → `ExercisePicker` → selects Lateral Raises. `exercise/added` appends it with one empty set and emits `add-exercise`. The island fetches `GET /api/workouts/[id]/exercise-context?exerciseIds=…` and merges the result with `exercise/context-loaded`.

User opens the exercise menu → *Superserie con…* → picks the previous exercise. `exercise/superset-linked` gives both the same `supersetGroup` and makes them contiguous (`reorder-exercises` if rows moved), emitting one `update-exercise` per row. `SupersetBar` labels them A1 and A2 ([FR-WT-025](../../../../prd/features/workout-tracking.md#fr-wt-025)).

### Step 8 - Superset rest

User checks a set of A1: no timer starts. User checks a set of A2, the last member of the group: the timer starts with A2's rest.

### Step 9 - Reorder, replace, remove

- Drag handle or *Subir/Bajar* → `exercise/moved` → `reorder-exercises`.
- *Reemplazar* → `exercise/replaced`. If the exercise types differ, the user first confirms that the values will be cleared ([FR-WT-024](../../../../prd/features/workout-tracking.md#fr-wt-024)).
- *Eliminar* → if the exercise has completed sets, confirm "Se borrarán N series" → `exercise/removed` → `remove-exercise`.

### Step 10 - Finish

User taps *Terminar* → [finish-workout.flow.md](./finish-workout.flow.md).

---

## Failure: Another workout already in progress

At Step 2 the dashboard already shows `InProgressBanner` "Entrenamiento en curso · 00:42:10 · Continuar". *Empezar* asks **Continuar el actual** / **Descartar y empezar nuevo** ([FR-WT-019](../../../../prd/features/workout-tracking.md#fr-wt-019)). *Descartar y empezar nuevo* sends `discardInProgress: true`. If the server finds another in-progress workout and the flag is not set (it was started on another device), it returns `422 workout_in_progress` with that workout's id, and the client navigates to it.

## Failure: Invalid set on check

At Step 5 the reps field is empty. `set/checked` does not complete the set: it sets `invalidFields = ['reps']`, the row shakes and is highlighted, and no command is emitted ([FR-WT-033](../../../../prd/features/workout-tracking.md#fr-wt-033)).

## Failure: Server rejects a command

`UpsertSetUseCase` returns `400`, for example because the exercise was replaced on another device and the metrics no longer fit its type. The worker moves the entry to `outbox_failed` and shows "1 cambio no se pudo guardar". The local state is kept, and later commands keep draining.

## Edge Case: Offline mid-session

The connection drops after Step 3. Every action still updates the UI and enqueues its command. The worker gets network errors and backs off (max 5 min); `SyncStatus.online = false` shows "Sin conexión · N cambios pendientes". From story 12.3 the outbox and the state snapshot live in IndexedDB, so a reload restores everything (`state/restored`). On `online` the queue drains in `seq` order, and replays are idempotent.

## Edge Case: Starting offline

From story 12.3 the dashboard is served from the cache, and *Empezar* builds the skeleton from the cached plan. Suggestions are labelled "Sugerencia sin conexión" ([ADR-025 §6](../../../decisions/025-offline-live-workout.md)). `start-workout` waits in the outbox, and the island hydrates from the `sessions` snapshot.

Decision: offline navigation to `/workout/[id]` is served by the service worker from a precached live-workout shell that reads the snapshot instead of the SSR prop. (Simplest way to open a page the server never rendered.)

## Edge Case: Same workout open on two devices

Both devices send upserts stamped with their own `updatedAt`. The server keeps the newest version of each row and answers `stale` to older ones ([ADR-025 §5](../../../decisions/025-offline-live-workout.md)). A device sees the other's changes after its next reload; there is no live push.

## Edge Case: Timer while the phone is locked

The countdown is derived from the absolute `endsAt`. After unlock, `visibilitychange` recomputes it. If it reached 0 while the screen was locked, the vibration and sound fire once on resume, and the notification (when granted) fired on time.
