# UI Components

Parent: [./readme.md](./readme.md) · Up: [../README.md](../README.md)

> **Updated 2026-10-29.** The Astro components (`*.astro`, React islands) were removed in Phase 1 of the [mobile migration](../planning/mobile-migration-plan.md). They remain readable at the git tag `pre-migration`, for example `git show pre-migration:src/components/exercise-card.astro`. This page describes the Svelte 5 app in `apps/app`.

## Conventions

| Topic | Rule |
|-------|------|
| Files | kebab-case for routes, helpers and stores (`workout-session.ts`); PascalCase for Svelte components (`AppNav.svelte`) |
| Runes | State uses `$state`, `$derived` and `$props`. Shared reactive state is a class in a `*.svelte.ts` file (`session.svelte.ts`, `sync.svelte.ts`) |
| Imports | `#lib/...` maps to `src/lib/...` (package.json `imports`). Files that must also run in plain Vitest (the offline engine) use relative imports |
| Data | Components never call `fetch`. They use `api()` or `cachedGet()` with a schema from `@gym-up/contracts` |
| Errors | `NetworkError` means "no signal" (show cached data or queue the change); `ApiRequestError` means the server rejected the request (show its message) |
| Language | UI text is Spanish; code, comments and docs are English |
| Styling | Global tokens and utility classes in `src/app.css` (`--bg`, `--surface`, `--accent`, `.card`, `.list`, `.muted`, `.error`, `.ok`); component-specific rules in the component's `<style>` |

## Routes (`src/routes`)

| Route | Purpose |
|-------|---------|
| `/` | Redirects to `/dashboard` or `/login` depending on the stored token |
| `/login`, `/register` | Forms; on success store the token and seed the cached user (`session.set`) |
| `/dashboard` | Today's workout from the cache-backed `GET /workouts/today`; starts or continues a workout locally first |
| `/workout/[id]` | Local-first set logging: rows are persisted to IndexedDB, queued in the outbox, with a rest timer and a finish action |
| `/history` | Paginated history from the cache-backed `GET /workouts` |
| `/nutrition` | Daily summary and calorie goal, meal photo analysis or manual entry, history with delete |
| `/photos` | Private progress photos: capture or pick, compressed on the device, thumbnails fetched with the bearer token |
| `/settings` | Name, weight unit, routine type, account and sign-out |
| `/more` | Links to Historial, Fotos and Ajustes |
| `/progress` | Streak, 28-day calendar and a per-exercise Chart.js line chart (max weight or volume, 7 days, 30 days or all) |
| `/family`, `/family/[id]` | Every member's workout count, streak and dates (read-only; never photos or body data) |

## Shared components (`src/lib/components`)

| Component | Role |
|-----------|------|
| `AppNav.svelte` | Fixed bottom navigation (Inicio, Progreso, Comida, Familia, Más) |
| `SyncBanner.svelte` | Pending and failed sync counts, with Retry and Discard actions for rejected commands |
| `ProgressChart.svelte` | Chart.js line chart created once and updated in place when its props change |

## Non-visual building blocks (`src/lib`)

| Module | Role |
|--------|------|
| `api/client.ts` | Typed fetch wrapper: bearer token, 10 s timeout, schema validation, 401 clears the token |
| `api/token.ts` | `TokenStore` over `localStorage` (replaceable by secure storage in the Tauri build) |
| `session.svelte.ts` | Current user, `require()` guard for pages, `signOut()` |
| `offline/idb.ts` | IndexedDB wrapper with the `outbox`, `failed` and `kv` stores |
| `offline/outbox.ts` | Command queue and in-order sync engine (backoff, retry, failed store, id remapping, coalescing) |
| `offline/sync.svelte.ts` | Reactive facade: pending count, online state, the sync loop |
| `offline/cache.ts` | Read-through cache for GET endpoints |
| `offline/workout-session.ts` | Local snapshot of the open workout and the `active-workout` pointer |
| `api/binary.ts` | Authenticated blob download, raw upload and delete (photos) |
| `image.ts` | On-device JPEG compression and base64 encoding |
| `notify.ts` | Android local notification for the end of the rest (no-op on the web) |

## Phase 2 component specs

> **Implementation note (2026-10-29).** The specs below were written against the Astro + React stack. The **behavior, props, UX rules and acceptance links stand**. The implementation is Svelte 5 in `apps/app`, following the conventions at the top of this page, so read the terms as follows:
>
> | In the specs | In the current stack |
> |--------------|----------------------|
> | React island, `client:load`, `client:visible`, `.tsx` | Svelte component in `apps/app/src/lib/components` or a route (`.svelte`) |
> | Astro page or `.astro` component | SvelteKit route in `apps/app/src/routes` (client-rendered, no SSR) |
> | `/api/...` endpoints and PRG forms | Typed calls through `api()` with `packages/contracts` schemas |
> | Service worker caching, PWA shell | Read-through cache and IndexedDB outbox ([ADR-025](./decisions/025-offline-live-workout.md), amended by ADR-027) |
> | `src/components/...` paths | `apps/app/src/lib/components/...` |
>
> The live workout is the first of these specs already built (`apps/app/src/routes/workout/[id]/+page.svelte`, local-first with the outbox); the rest follow their stories.

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |

Stories: [phase-2](../stories/phase-2/readme.md). Island architecture: [ADR-015](./decisions/015-live-workout-react-island.md).

### Phase 2 conventions

- **React only** for interactive UI (`.tsx`), Astro for static UI (`.astro`). No Svelte ([ADR-015](./decisions/015-live-workout-react-island.md)).
- Folders by area: `src/components/<area>/<name>.tsx|astro` (`live-workout/`, `navigation/`, `gym-tools/`, `exercise-library/`, `routines/`, `progression/`, `progress/`, `body-metrics/`, `photos/`, `social/`). Phase 1 files stay at `src/components/` until a story moves them.
- **Type** column values:
  - **Island** — mounted from an Astro page with the client directive shown.
  - **Island child** — React component rendered inside another island; never hydrated on its own.
  - **Static** — `.astro`, or a `.tsx` rendered without a client directive (SSR only, zero JS).
- Islands receive server data as JSON props and call only `src/pages/api/**`. They may import pure domain modules, never repositories ([phase-2 rules](../stories/phase-2/readme.md#4-islands)).
- **Mobile first.** Layouts are designed at **360 px** width first, and every tap target is ≥ **44 × 44 px**. Number inputs use `inputmode="decimal"` (weight, distance) or `"numeric"` (reps, seconds) (NFR-WT-P2-04). Sheets are bottom sheets on mobile and centered modals at ≥ 768 px.
- Copy is Spanish; exercise names are English. Weights display in `weight_unit` and are stored in kg ([ADR-006](./decisions/006-kg-storage.md)).
- Decision: shared presentational pieces used both inside islands and on static pages (`PrBadge`, `ExerciseListItem`) are `.tsx` and rendered without a client directive on static pages. (Simplest: one implementation.)

---

## Navigation v2

Feature: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-044, FR-WT-045, FR-WT-019 · Story [9.4](../stories/phase-2/round-9/story-9.4.md) (banner: [9.1](../stories/phase-2/round-9/story-9.1.md)). Replaces Phase 1 [Navigation](#navigation).

### TabBar

**File**: `src/components/navigation/tab-bar.astro` · **Type**: Static · **Rendered by**: `src/layouts/layout.astro`

| Prop | Type | Description |
|------|------|-------------|
| `activeTab` | `'inicio' \| 'entrenar' \| 'progreso' \| 'perfil'` | Highlighted tab, derived from the route |
| `hasUnseenActivity` | `boolean` | Dot on *Inicio* ([FR-SO-006](../prd/features/social.md#fr-so-006)) |

| Tab | Label | Route |
|---|---|---|
| 🏠 | Inicio | `/dashboard` |
| 🏋 | Entrenar | `/train` |
| 📊 | Progreso | `/progress` |
| 👤 | Perfil | `/profile` |

- Mobile (< 768 px): fixed bottom bar, 4 equal targets ≥ 56 px tall, `padding-bottom: env(safe-area-inset-bottom)`. Desktop: the same links in the top bar.
- Hidden on `/`, `/login`, `/register`, `/onboarding` and the live workout (`/workout/[id]` while in progress), which needs the full height.
- `aria-current="page"` on the active tab.

### InProgressBanner

**File**: `src/components/navigation/in-progress-banner.tsx` · **Type**: Island (`client:load`) · **Rendered by**: `layout.astro` when `GetActiveWorkoutUseCase` returns a workout

| Prop | Type | Description |
|------|------|-------------|
| `workoutId` | `string` | Active workout |
| `name` | `string` | Workout name |
| `startedAt` | `number` | Epoch ms; the elapsed clock ticks every second |

- Sticky, directly above the tab bar: "Entrenamiento en curso · 00:42:10 · Continuar" ([FR-WT-019](../prd/features/workout-tracking.md#fr-wt-019)). The whole bar is the tap target (≥ 48 px) → `/workout/[id]`.
- Not rendered on `/workout/[id]` itself. Hidden locally once the island finishes or discards the workout.

---

## Live Workout

Feature: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-018 … FR-WT-039 · Stories [9.1](../stories/phase-2/round-9/story-9.1.md), [9.2](../stories/phase-2/round-9/story-9.2.md), [9.3](../stories/phase-2/round-9/story-9.3.md), [12.3](../stories/phase-2/round-12/story-12.3.md). State, actions and outbox: [workout-tracking context → Island](./contexts/workout-tracking/readme.md#island-liveworkout). Replaces [ExerciseCard](#exercisecard) and [RestTimer](#resttimer).

### LiveWorkout

**File**: `src/components/live-workout/live-workout.tsx` · **Type**: Island (`client:load`) · **Page**: `/workout/[id]`

| Prop | Type | Description |
|------|------|-------------|
| `initial` | `LiveWorkoutInitialState` | From `GetLiveWorkoutStateUseCase` (workout, exercises, sets, previous, suggestions, PR baselines, settings, `mode`) |

- Owns the reducer (`live-workout.reducer.ts`), the outbox and the sync worker. Children receive state slices and `dispatch`.
- Layout, top to bottom: `WorkoutHeader` (sticky), `ExerciseBlock` list, *+ Añadir ejercicio* (full-width, 48 px), `RestTimerBar` (sticky bottom).
- Shows the sync state: "Sin conexión · N cambios pendientes", and the `outbox_failed` banner "N cambios no se pudieron guardar".
- `mode: 'edit'` (FR-WT-039): no clock, no timer, no suggestions; *Guardar* / *Cancelar*; editable start date/time and duration.
- First screen when `showReadinessStep`: `ReadinessStep` ([FR-PG-009](../prd/features/progression.md#fr-pg-009)). Afterwards, the adjustment banner "Sesión ajustada: −1 serie" with *Usar plan original* ([FR-PG-010](../prd/features/progression.md#fr-pg-010)).

### WorkoutHeader

**File**: `src/components/live-workout/workout-header.tsx` · **Type**: Island child

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Editable inline (1–60) |
| `startedAt` | `number` | Elapsed clock source |
| `volumeKg` | `number` | Σ weight × reps of completed sets, shown in `weightUnit` |
| `completedSets` | `number` | Count |
| `weightUnit` | `'kg' \| 'lbs'` | Display |
| `mode` | `'live' \| 'edit'` | Edit mode swaps *Terminar* for *Guardar* / *Cancelar* |
| `dispatch` | `Dispatch<LiveWorkoutAction>` | |

- Row 1: name (tap to edit) and *Terminar* (top-right, primary). Row 2: `00:42:10 · 4 320 kg · 12 series` ([FR-WT-020](../prd/features/workout-tracking.md#fr-wt-020)).
- Overflow menu: *Notas del entrenamiento*, *Descartar entrenamiento* (confirm, [FR-WT-038](../prd/features/workout-tracking.md#fr-wt-038)).
- The clock updates once per second from `startedAt`, never from a counter.

### ExerciseBlock

**File**: `src/components/live-workout/exercise-block.tsx` · **Type**: Island child

| Prop | Type | Description |
|------|------|-------------|
| `exercise` | `LiveExercise` | Exercise, sets, notes, superset group, rest |
| `supersetLabel` | `string \| null` | `A1`, `A2`, … |
| `suggestion` | `ExerciseSuggestion \| undefined` | For `SuggestionChip` (progression type) |
| `previous` | `PreviousSet[]` | For `PreviousCell` |
| `settings` | `TrainingSettings` | Units, RPE, bar and plates |
| `dispatch` | `Dispatch<LiveWorkoutAction>` | |

- Header: exercise name (link to `/exercises/[id]` in a sheet), primary muscle, `SuggestionChip`, rest value (*Descanso: 2:00*, tap to edit), drag handle (≥ 44 px), ⋯ menu.
- Menu: *Reemplazar*, *Superserie con…* / *Quitar de superserie*, *Añadir calentamiento* (`WarmupGenerator`), *Subir* / *Bajar* (accessible reorder), *Eliminar* (confirm "Se borrarán N series" when it has completed sets).
- "Nota de la rutina" read-only above an editable session note ([FR-WT-026](../prd/features/workout-tracking.md#fr-wt-026)).
- Column headers follow `exercise_type` ([FR-WT-027](../prd/features/workout-tracking.md#fr-wt-027)): *Serie · Anterior · Peso · Reps · (RPE) · ✓*.
- *+ Añadir serie* copies the last set; hidden at 20 sets.
- Decision: drag reorder uses pointer events with a 250 ms long-press on the handle; the *Subir/Bajar* menu items are the accessible fallback. (Simplest; no drag library.)

### SetRow

**File**: `src/components/live-workout/set-row.tsx` · **Type**: Island child

| Prop | Type | Description |
|------|------|-------------|
| `set` | `LiveSet` | Values, `prefill`, `prs`, `invalidFields` |
| `label` | `string` | `W` / `D` / `F` / ordinal ([ADR-016 §4](./decisions/016-workout-data-model-v2.md)) |
| `exerciseType` | `ExerciseType` | Decides the inputs |
| `equipment` | `Equipment` | Shows the 🏋 plate button for `barbell` / `smith_machine` |
| `previous` | `PreviousSet \| null` | Same-position previous set |
| `settings` | `TrainingSettings` | Unit, RPE toggle |
| `dispatch` | `Dispatch<LiveWorkoutAction>` | |

- Grid at 360 px: label 40 px · Anterior flexible · inputs 64 px each · ✓ 44 px. Inputs are ≥ 44 px tall.
- Prefilled values render muted until edited or checked ([FR-WT-030](../prd/features/workout-tracking.md#fr-wt-030)).
- ✓ dispatches `set/checked`. Invalid → shake (200 ms) plus red outline on `invalidFields` ([FR-WT-033](../prd/features/workout-tracking.md#fr-wt-033)). Checked rows get a green tint.
- Duration input `mm:ss`; distance in km/mi (or m/yd for `weight_distance`); assisted shows "−20 kg".
- RPE selector (6 … 10 in 0.5 steps) only when `rpeEnabled`.
- Swipe left reveals *Eliminar*; the row menu offers the same.
- `PrBadge` inline when `set.prs.length > 0`.

### SetTypeMenu

**File**: `src/components/live-workout/set-type-menu.tsx` · **Type**: Island child

| Prop | Type | Description |
|------|------|-------------|
| `setId` | `string` | Target set |
| `current` | `SetType` | Checked option |
| `dispatch` | `Dispatch<LiveWorkoutAction>` | |

- Opens from the set label. Options: **Normal**, **Calentamiento (W)**, **Drop set (D)**, **Al fallo (F)** ([FR-WT-028](../prd/features/workout-tracking.md#fr-wt-028)). Each option is a 48 px row.

### PreviousCell

**File**: `src/components/live-workout/previous-cell.tsx` · **Type**: Island child

| Prop | Type | Description |
|------|------|-------------|
| `previous` | `PreviousSet \| null` | From `pickPreviousSet` |
| `exerciseType` | `ExerciseType` | Formatting |
| `weightUnit` | `'kg' \| 'lbs'` | Display |
| `onCopy` | `() => void` | Dispatches `set/previous-copied` |

- Shows "60 kg × 10", "0:45", "2.5 km · 12:30" or "—" ([FR-WT-029](../prd/features/workout-tracking.md#fr-wt-029)). The whole cell (≥ 44 px) is a button that copies the values.

### RestTimerBar

**File**: `src/components/live-workout/rest-timer-bar.tsx` · **Type**: Island child · **Hook**: `use-rest-timer.ts`

| Prop | Type | Description |
|------|------|-------------|
| `timer` | `RestTimerState \| null` | Hidden when `null` |
| `exerciseName` | `string` | Label |
| `dispatch` | `Dispatch<LiveWorkoutAction>` | |

- Sticky bottom bar with a progress fill: `1:45` · **−15 s** · **+15 s** · *Saltar* (each ≥ 44 px). Tapping the time opens a picker that dispatches `exercise/rest-changed` ([FR-WT-034](../prd/features/workout-tracking.md#fr-wt-034)).
- At 0: vibration, sound and notification come from `use-rest-timer`; the bar flashes once, then hides.
- `role="timer"` with `aria-live="polite"` announcing only the start and the end.

### SupersetBar

**File**: `src/components/live-workout/superset-bar.tsx` · **Type**: Island child

| Prop | Type | Description |
|------|------|-------------|
| `group` | `number` | Superset group |
| `color` | `string` | One of 6 token colors, by group order |
| `memberCount` | `number` | For the label |

- 4 px colored vertical bar on the left edge of contiguous member blocks, plus the A1/A2 labels ([FR-WT-025](../prd/features/workout-tracking.md#fr-wt-025)). Decorative: `aria-hidden`, the labels carry the meaning.

### FinishDialog

**File**: `src/components/live-workout/finish-dialog.tsx` · **Type**: Island child

| Prop | Type | Description |
|------|------|-------------|
| `completedSets` | `number` | |
| `uncheckedWithValues` | `number` | |
| `startedAt` | `number` | For the > 180 min check |
| `lastCompletedAt` | `number \| null` | Default end time |
| `onConfirm` | `(r: { completedAt: number; uncheckedResolution: 'complete' \| 'discard' }) => void` | Dispatches `workout/finished` |
| `onDiscard` | `() => void` | Dispatches `workout/discarded` |

- Steps per [FR-WT-035](../prd/features/workout-tracking.md#fr-wt-035): "Tienes N series sin marcar" (**Marcarlas como hechas** / **Descartarlas**) → "¿Olvidaste terminar?" (editable end time) → confirm. Zero completed → "Registra al menos una serie" with *Descartar entrenamiento*.
- Full-width stacked buttons on mobile. The primary action is at the bottom, within thumb reach.
- Flow: [finish-workout.flow.md](./contexts/workout-tracking/flows/finish-workout.flow.md).

### WorkoutSummary v2

**File**: `src/components/workout-summary/workout-summary.tsx` (replaces `src/components/workout-summary.astro`) · **Type**: Island (`client:load`) · **Page**: `/workout/[id]` (completed, owner) · **Feature**: FR-WT-036, FR-PR-010 · Story [9.3](../stories/phase-2/round-9/story-9.3.md)

| Prop | Type | Description |
|------|------|-------------|
| `summary` | `WorkoutSummary` | From `GetWorkoutSummaryUseCase`: duration, volume, completed sets, top 5 muscles, previous comparison |
| `prs` | `WorkoutPr[]` | From progress `GetWorkoutPrsUseCase` (type, value, exercise) |
| `name` | `string` | Editable |
| `notes` | `string \| null` | Editable |
| `weightUnit` | `'kg' \| 'lbs'` | Display |
| `canSaveAsRoutine` | `boolean` | Has ≥ 1 completed working set |

- Stat tiles in a 2 × 2 grid at 360 px: Duración, Volumen, Series, Récords. Volume Δ % vs the previous same-routine workout ("+6 % vs la última Push A").
- PR list with 🏆, record label and value. Sets per muscle as horizontal bars (top 5).
- Name and notes are edited inline, saved with `PATCH /api/workouts/[id]` on blur.
- Actions: *Añadir foto* → `/photos?workout=[id]`, `ShareImageButton`, *Guardar como rutina* (FR-RT-018), *Editar* (`?mode=edit`), *Listo* → `/dashboard`.
- Decision: one island instead of static markup plus a form, because the name/notes edit and Share need JS anyway. (Simplest.)

---

## Gym Tools

Feature: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-040 … FR-WT-042 · Story [9.5](../stories/phase-2/round-9/story-9.5.md). Pure logic: `plate-calculator.ts`, `warmup-generator.ts` ([context](./contexts/workout-tracking/readme.md#pure-domain-modules)); e1RM from progress `personal-records.ts` ([ADR-020](./decisions/020-personal-records.md)).

### PlateCalculatorSheet

**File**: `src/components/gym-tools/plate-calculator-sheet.tsx` · **Type**: Island child (of `LiveWorkout`)

| Prop | Type | Description |
|------|------|-------------|
| `targetWeight` | `number` | In display unit, from the set row |
| `barWeight` | `number` | Display unit, from settings |
| `plates` | `number[]` | Display unit, from settings |
| `weightUnit` | `'kg' \| 'lbs'` | |
| `onClose` | `() => void` | |

- Opens from the 🏋 button next to the weight input (barbell / smith machine only, [FR-WT-040](../prd/features/workout-tracking.md#fr-wt-040)).
- Shows a bar drawing with colored plates per side plus the list "Por lado: 20 + 10 + 2.5". If the weight is not loadable: "No se puede cargar exacto · 97.5 kg / 100 kg", each a button that sets the row weight.

### WarmupGenerator

**File**: `src/components/gym-tools/warmup-generator.tsx` · **Type**: Island child (of `LiveWorkout`)

| Prop | Type | Description |
|------|------|-------------|
| `workoutExerciseId` | `string` | Target exercise |
| `firstWorkingWeight` | `number \| null` | kg; `null` → "Introduce el peso de la primera serie" |
| `barWeightKg` | `number` | |
| `platesKg` | `number[]` | |
| `dispatch` | `Dispatch<LiveWorkoutAction>` | |

- From the exercise menu (*Añadir calentamiento*). Previews the generated sets (40 % × 10, 60 % × 5, 80 % × 3, rounded, below-bar skipped, [FR-WT-041](../prd/features/workout-tracking.md#fr-wt-041)); *Añadir* dispatches `exercise/warmups-added`.

### OneRmCalculator

**File**: `src/components/gym-tools/one-rm-calculator.tsx` · **Type**: Island (`client:visible`) · **Page**: `/profile/tools`

| Prop | Type | Description |
|------|------|-------------|
| `weightUnit` | `'kg' \| 'lbs'` | Input and output unit |

- Weight + reps (1–12) → e1RM (Epley), and a table of 50–95 % in 5 % steps with rep ranges ([FR-WT-042](../prd/features/workout-tracking.md#fr-wt-042)). Fully client-side, no API.

---

## Exercise Library

Feature: [exercise-library](../prd/features/exercise-library.md) FR-EL-001 … FR-EL-009 · Stories [7.3](../stories/phase-2/round-7/story-7.3.md), [7.4](../stories/phase-2/round-7/story-7.4.md). Data: [ADR-017](./decisions/017-exercise-catalog.md).

### ExercisePicker

**File**: `src/components/exercise-library/exercise-picker.tsx` · **Type**: Island child (of `LiveWorkout`, `RoutineBuilder`) and Island (`client:load`) on `/exercises`

| Prop | Type | Description |
|------|------|-------------|
| `variant` | `'sheet' \| 'page'` | Bottom sheet for picking, full page for browsing |
| `exercises` | `ExerciseListItemData[]` | System + own custom, non-archived (cached by the SW, [ADR-025](./decisions/025-offline-live-workout.md)) |
| `recent` | `string[]` | Up to 8 recently logged ids ([FR-EL-004](../prd/features/exercise-library.md#fr-el-004)) |
| `multiSelect` | `boolean` | Live workout add = true; replace = false |
| `excludeIds` | `string[]` | Hidden (e.g. replace target) |
| `onSelect` | `(ids: string[]) => void` | `sheet` only |

- Search input autofocused in `sheet`, debounced 150 ms, case- and accent-insensitive ([FR-EL-002](../prd/features/exercise-library.md#fr-el-002)). `ExerciseFilters` below it. Sections: *Recientes*, then A–Z.
- Multi-select shows a sticky *Añadir (N)* button. *Crear ejercicio* opens `CustomExerciseForm`.
- `page` variant: rows link to `/exercises/[id]`.
- Virtualized list is not required at 100–200 rows; plain list with `content-visibility: auto`.
- Decision: `/exercises` reuses the picker with `variant="page"` instead of a separate browser component. (One search/filter implementation.)

### ExerciseListItem

**File**: `src/components/exercise-library/exercise-list-item.tsx` · **Type**: Island child / Static

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | English |
| `muscleGroup` | `MuscleGroup` | Spanish label ([FR-EL-011](../prd/features/exercise-library.md#fr-el-011)) |
| `equipment` | `Equipment` | Spanish label |
| `isCustom` | `boolean` | "Personalizado" tag |
| `selected` | `boolean` | Checkmark in multi-select |

- Row ≥ 56 px: name (bold), "Pecho · Barra" subtitle, tag and checkmark.

### ExerciseFilters

**File**: `src/components/exercise-library/exercise-filters.tsx` · **Type**: Island child

| Prop | Type | Description |
|------|------|-------------|
| `muscles` | `MuscleGroup[]` | Selected |
| `equipment` | `Equipment[]` | Selected |
| `onChange` | `(f: { muscles: MuscleGroup[]; equipment: Equipment[] }) => void` | |

- Two chip buttons, *Músculo* and *Equipo*, each opening a multi-select list. AND across groups, OR within a group. *Limpiar* resets. Active chips show a count.

### CustomExerciseForm

**File**: `src/components/exercise-library/custom-exercise-form.tsx` · **Type**: Island child (of `ExercisePicker`) and Island (`client:load`) on the custom-exercise create/edit pages

| Prop | Type | Description |
|------|------|-------------|
| `initial` | `CustomExerciseDraft \| null` | `null` = create |
| `typeLocked` | `boolean` | `exercise_type` locked once sets reference it ([FR-EL-007](../prd/features/exercise-library.md#fr-el-007)) |
| `onSaved` | `(id: string) => void` | |

- Fields per [FR-EL-006](../prd/features/exercise-library.md#fr-el-006): name (2–60), primary muscle, secondary muscles, equipment, type, optional instructions and video link. Inline errors such as "Ya existe en la biblioteca".
- *Archivar* / *Restaurar* for the owner ([FR-EL-008](../prd/features/exercise-library.md#fr-el-008)). Endpoints are defined in the exercise-library context.

---

## Programs & Routines

Feature: [routines](../prd/features/routines.md) FR-RT-001 … FR-RT-018 · Stories [8.2](../stories/phase-2/round-8/story-8.2.md), [8.3](../stories/phase-2/round-8/story-8.3.md), [8.4](../stories/phase-2/round-8/story-8.4.md). Data: [ADR-018](./decisions/018-user-owned-programs.md), [ADR-019](./decisions/019-rotation-scheduling-and-onboarding.md).

### ProgramList

**File**: `src/components/routines/program-list.astro` · **Type**: Static · **Page**: `/train`

| Prop | Type | Description |
|------|------|-------------|
| `programs` | `ProgramSummary[]` | Non-archived, active first |
| `activeProgramId` | `string \| null` | |

- *Mis programas* list of `ProgramCard`, then *Explorar plantillas* (`/train/templates`), *Entrenamiento libre* and *Biblioteca de ejercicios* as 48 px full-width actions ([FR-RT-001](../prd/features/routines.md#fr-rt-001)).

### ProgramCard

**File**: `src/components/routines/program-card.astro` · **Type**: Static

| Prop | Type | Description |
|------|------|-------------|
| `program` | `ProgramSummary` | Name, routines count, days/week |
| `isActive` | `boolean` | "Activo" badge |
| `routines` | `{ id: string; name: string }[]` | Each links to its builder |

- Card with the name, "Activo" badge and routine chips. ⋯ menu (`<details>`, no JS): *Activar*, *Editar*, *Archivar* / *Eliminar* ([FR-RT-003](../prd/features/routines.md#fr-rt-003), [FR-RT-004](../prd/features/routines.md#fr-rt-004)), as PRG forms.

### RoutineBuilder

**File**: `src/components/routines/routine-builder.tsx` · **Type**: Island (`client:load`) · **Page**: `/train/routines/[id]/edit` and the new-routine page

| Prop | Type | Description |
|------|------|-------------|
| `routine` | `RoutineDraft \| null` | `null` = new |
| `programId` | `string` | Destination program |
| `exercises` | `ExerciseListItemData[]` | For the picker |
| `weightUnit` | `'kg' \| 'lbs'` | |

- Name (1–60), notes (≤ 500), exercise list with per-exercise target sets, rep range, warm-up sets, rest (15 s steps or *Por defecto*), RPE, superset link and note ([FR-RT-008](../prd/features/routines.md#fr-rt-008)).
- Reorder uses the same handle + *Subir/Bajar* pattern as `ExerciseBlock`.
- *Guardar* / *Cancelar*; leaving with unsaved changes asks for confirmation (`beforeunload` + in-app guard).

### NextWorkoutCard

**File**: `src/components/routines/next-workout-card.tsx` · **Type**: Island (`client:load`) · **Page**: `/dashboard`

| Prop | Type | Description |
|------|------|-------------|
| `next` | `NextRoutineView \| null` | Routine, program, exercises (name + sets × range), estimated duration, plan for the skeleton, previous values and suggestions |
| `otherRoutines` | `{ routineDayId: string; name: string; lastDoneDaysAgo: number \| null; fatigued: boolean }[]` | *Elegir otra rutina* ([FR-RT-012](../prd/features/routines.md#fr-rt-012)) |
| `activeWorkout` | `{ id: string; name: string } \| null` | Triggers the continue/discard choice |

- "Siguiente: Push A" with the exercise list, "≈ 55 min", readiness/recovery hints and a full-width *Empezar* (56 px) ([FR-RT-011](../prd/features/routines.md#fr-rt-011)).
- *Empezar* → client-built skeleton → `start-workout` command → `/workout/[id]` (the readiness step runs there) ([live-workout.flow.md](./contexts/workout-tracking/flows/live-workout.flow.md)).
- With an active workout: **Continuar el actual** / **Descartar y empezar nuevo** ([FR-WT-019](../prd/features/workout-tracking.md#fr-wt-019)).
- With no active program: "Elige tu programa" card → `/onboarding`, plus *Entrenamiento libre* ([FR-RT-014](../prd/features/routines.md#fr-rt-014)).

### OnboardingWizard

**File**: `src/components/routines/onboarding-wizard.tsx` · **Type**: Island (`client:load`) · **Page**: `/onboarding`

| Prop | Type | Description |
|------|------|-------------|
| `templates` | `TemplateSummary[]` | The 7 seeded templates |
| `hasProgram` | `boolean` | Migrated user → offers "Mantener mi programa actual" |
| `initialAnswers` | `OnboardingAnswers \| null` | From profile (Ajustes → *Cambiar programa*) |

- 5 single-choice steps with progress dots, *Atrás* / *Siguiente*, options as 56 px cards ([FR-RT-015](../prd/features/routines.md#fr-rt-015)).
- Result: recommended template with the reason sentence, 2 alternatives and *Ver todas las plantillas* ([FR-RT-016](../prd/features/routines.md#fr-rt-016)). Scoring is the pure rule of [ADR-019 §3](./decisions/019-rotation-scheduling-and-onboarding.md), run client-side for instant results and re-checked by the server on adopt.

---

## Progression

Feature: [progression](../prd/features/progression.md) FR-PG-001 … FR-PG-013 · Stories [10.2](../stories/phase-2/round-10/story-10.2.md), [10.3](../stories/phase-2/round-10/story-10.3.md), [10.4](../stories/phase-2/round-10/story-10.4.md). Rules: [ADR-021](./decisions/021-progression-engine.md), [ADR-022](./decisions/022-readiness-and-recovery.md). All hidden when `progression_enabled = false` ([FR-PG-013](../prd/features/progression.md#fr-pg-013)).

### SuggestionChip

**File**: `src/components/progression/suggestion-chip.tsx` · **Type**: Island child (of `ExerciseBlock`)

| Prop | Type | Description |
|------|------|-------------|
| `suggestion` | `ExerciseSuggestion` | `suggestion: null` → first-exposure hint (`firstTimeHint`) |
| `targetReps` | `{ min: number; max: number } \| null` | For the hint text |
| `weightUnit` | `'kg' \| 'lbs'` | |
| `onOpen` | `() => void` | Opens `SuggestionWhySheet` or `PlateauSheet` |

- "Sugerido: 62.5 kg × 8" ([FR-PG-001](../prd/features/progression.md#fr-pg-001)); amber "Estancado" marker when `plateaued` ([FR-PG-006](../prd/features/progression.md#fr-pg-006)); "Sugerencia sin conexión" when the suggestion came from the cached dashboard payload. First exposure: "Primera vez: elige un peso con el que llegues a 8–12 reps con 2 en reserva" ([FR-PG-005](../prd/features/progression.md#fr-pg-005)).
- Chip height ≥ 32 px, tap area padded to 44 px.

### SuggestionWhySheet

**File**: `src/components/progression/suggestion-why-sheet.tsx` · **Type**: Island child

| Prop | Type | Description |
|------|------|-------------|
| `suggestion` | `ExerciseSuggestion` | Reason code and `explanation` |
| `lastExposure` | `PreviousSet[]` | For the sentence |
| `weightUnit` | `'kg' \| 'lbs'` | |

- *¿Por qué?* explanation built from the reason code ([FR-PG-002](../prd/features/progression.md#fr-pg-002)), e.g. "La última vez hiciste 12, 12 y 12 reps con 60 kg (tope del rango 8–12). Subimos 2.5 kg."

### PlateauSheet

**File**: `src/components/progression/plateau-sheet.tsx` · **Type**: Island child (of `ExerciseBlock`) and Island (`client:visible`) on `/exercises/[id]`

| Prop | Type | Description |
|------|------|-------------|
| `exerciseId` | `string` | |
| `exerciseName` | `string` | |
| `currentRange` | `{ min: number; max: number }` | For *Cambiar rango* |

- Three 56 px options: **Bajar y reconstruir** (default), **Cambiar rango** (4 semanas), **Ignorar** (2 sesiones) ([FR-PG-007](../prd/features/progression.md#fr-pg-007)). Saves through the progression context endpoint (online only; disabled offline with "Necesita conexión").

### DeloadCard

**File**: `src/components/progression/deload-card.astro` · **Type**: Static · **Page**: `/dashboard`

| Prop | Type | Description |
|------|------|-------------|
| `reason` | `string` | "6 semanas sin descarga y 3 ejercicios estancados" |
| `active` | `{ until: Date } \| null` | Shows "Semana de descarga hasta el 12 oct" |

- "Semana de descarga recomendada" with **Empezar descarga** and **Ahora no** as PRG form buttons ([FR-PG-008](../prd/features/progression.md#fr-pg-008)).

### ReadinessStep

**File**: `src/components/progression/readiness-step.tsx` · **Type**: Island child (of `LiveWorkout`, shown when `showReadinessStep`)

| Prop | Type | Description |
|------|------|-------------|
| `fatiguedMuscles` | `MuscleGroup[]` | Muscles of the chosen routine currently `fatigued` |
| `workoutId` | `string` | Check-in target |
| `onDone` | `(r: { score: number; suggestions: ExerciseSuggestion[] } \| null) => void` | Dispatches `readiness/submitted`; `null` = *Saltar* (`readiness/skipped`) |

- Three 1–5 sliders (¿Cómo dormiste? / ¿Energía hoy? / ¿Agujetas / dolor?) with end labels ([FR-PG-009](../prd/features/progression.md#fr-pg-009)); thumb ≥ 44 px. "Músculo fatigado" warning list. *Empezar* and *Saltar*. The whole step takes ≤ 10 s. Submits to `POST /api/progression/readiness` ([progression readme](./contexts/progression/readme.md)); hidden offline.

### RecoveryWidget

**File**: `src/components/progression/recovery-widget.astro` · **Type**: Static · **Page**: `/dashboard`

| Prop | Type | Description |
|------|------|-------------|
| `muscles` | `{ muscle: MuscleGroup; recoveryPct: number; state: 'fresh' \| 'recovering' \| 'fatigued' }[]` | Last 7 days ([ADR-022 §2](./decisions/022-readiness-and-recovery.md)) |

- Front/back body silhouette (inline SVG, muscles colored by state) with a text list below for accessibility ([FR-PG-011](../prd/features/progression.md#fr-pg-011)). Front/back toggle is CSS-only (radio inputs), no JS.

---

## Progress v2

Feature: [progress](../prd/features/progress.md) FR-PR-008 … FR-PR-020 · Stories [10.1](../stories/phase-2/round-10/story-10.1.md), [11.2](../stories/phase-2/round-11/story-11.2.md), [11.4](../stories/phase-2/round-11/story-11.4.md). Records: [ADR-020](./decisions/020-personal-records.md). Charts: Chart.js React islands ([ADR-002](./decisions/002-chartjs-react-island.md)).

### PrBadge

**File**: `src/components/progress/pr-badge.tsx` · **Type**: Island child (in `SetRow`) / Static (summary, detail, feed)

| Prop | Type | Description |
|------|------|-------------|
| `records` | `RecordType[]` | One or more record types |
| `compact` | `boolean` | Icon only (feed card) |

- 🏆 with the Spanish label ("Mejor 1RM", "Peso máximo") ([FR-PR-009](../prd/features/progress.md#fr-pr-009)). In the live workout a toast and a haptic pulse fire once per set (owned by `LiveWorkout`).

### RecordsTable

**File**: `src/components/progress/records-table.astro` · **Type**: Static · **Page**: `/exercises/[id]` (*Récords* tab)

| Prop | Type | Description |
|------|------|-------------|
| `records` | `{ type: RecordType; value: number; date: Date; workoutId: string }[]` | Applicable types only |
| `exerciseType` | `ExerciseType` | Formatting |
| `weightUnit` | `'kg' \| 'lbs'` | |

- One row per record (≥ 48 px) with value, date and a link to `/workouts/[id]` ([FR-PR-011](../prd/features/progress.md#fr-pr-011)).

### RepMaxTable

**File**: `src/components/progress/rep-max-table.astro` · **Type**: Static

| Prop | Type | Description |
|------|------|-------------|
| `rows` | `{ reps: number; weight: number \| null; date: Date \| null }[]` | Reps 1–12 |
| `weightUnit` | `'kg' \| 'lbs'` | |

- Only for `weight_reps`. Two columns at 360 px: "Reps" and "Mejor peso · fecha".

### WeeklyBarsChart

**File**: `src/components/progress/weekly-bars-chart.tsx` · **Type**: Island (`client:visible`) · **Page**: `/progress` (*Resumen*)

| Prop | Type | Description |
|------|------|-------------|
| `weeks` | `{ weekStart: string; workouts: number; durationMin: number; volume: number; sets: number }[]` | Last 12 ISO weeks |
| `metric` | `'workouts' \| 'duration' \| 'volume' \| 'sets'` | Initial tab |
| `weightUnit` | `'kg' \| 'lbs'` | |

- Segmented control for the 4 metrics; tapping a bar lists that week's workouts below the chart ([FR-PR-014](../prd/features/progress.md#fr-pr-014)). Chart height 220 px at 360 px width.

### MuscleDistributionChart

**File**: `src/components/progress/muscle-distribution-chart.tsx` · **Type**: Island (`client:visible`)

| Prop | Type | Description |
|------|------|-------------|
| `period` | `'7d' \| '30d' \| '3m'` | Initial period |
| `data` | `Record<'7d' \| '30d' \| '3m', { muscle: MuscleGroup; sets: number; deltaPct: number \| null; flagged: boolean }[]>` | Precomputed for every period |

- Horizontal bars sorted descending with the Δ vs the previous period; muscles > 20 sets/week (normalized) flagged ([FR-PR-015](../prd/features/progress.md#fr-pr-015)).

### MonthCalendar

**File**: `src/components/progress/month-calendar.astro` · **Type**: Static · **Page**: `/progress`

| Prop | Type | Description |
|------|------|-------------|
| `month` | `string` | `YYYY-MM` (`?month=` query) |
| `days` | `{ date: string; workouts: { id: string; name: string }[]; deload: boolean }[]` | |

- 7-column grid, each day cell ≥ 44 px; workout days marked, deload days in a distinct color; ‹ › are links to the adjacent month ([FR-PR-016](../prd/features/progress.md#fr-pr-016)). A day with workouts is a `<details>` listing them. Replaces `calendar-grid.astro` on `/progress`.

### CoachSummaryCard

**File**: `src/components/progress/coach-summary-card.tsx` · **Type**: Island (`client:visible`) · **Page**: `/progress`

| Prop | Type | Description |
|------|------|-------------|
| `weekStart` | `string` | Last closed ISO week |
| `regenerationsLeft` | `number` | 0–3 |

- Fetches the summary after mount so the page never waits on the LLM; skeleton lines while loading. Shows ≤ 120 words plus 1–3 tips ([ADR-026](./decisions/026-weekly-ai-coach-summary.md)). *Ver semana actual* / *Generar resumen*; disabled with "Disponible el lunes" at 0 ([FR-PR-020](../prd/features/progress.md#fr-pr-020)). Offline: "Sin conexión". Endpoints are defined in the progress context.

---

## Body Metrics

Feature: [body-metrics](../prd/features/body-metrics.md) FR-BM-001 … FR-BM-007 · Story [11.1](../stories/phase-2/round-11/story-11.1.md). Owner-only ([ADR-023](./decisions/023-body-metrics-privacy.md)).

### MeasurementForm

**File**: `src/components/body-metrics/measurement-form.astro` · **Type**: Static (PRG form) · **Page**: `/profile/measurements/new`

| Prop | Type | Description |
|------|------|-------------|
| `initial` | `MeasurementDraft \| null` | Existing entry for the date (merge, [FR-BM-002](../prd/features/body-metrics.md#fr-bm-002)) |
| `weightUnit` | `'kg' \| 'lbs'` | kg + cm, or lb + in ([FR-BM-004](../prd/features/body-metrics.md#fr-bm-004)) |
| `errors` | `Record<string, string>` | Server validation |

- Date (default today, not in the future), then *Peso* and *% grasa* first, then the lengths grouped (Torso, Brazos, Piernas) in collapsible sections. At least one field is required ([FR-BM-001](../prd/features/body-metrics.md#fr-bm-001)). `inputmode="decimal"` on every field; 2 columns of 44 px inputs at 360 px.

### MeasurementChart

**File**: `src/components/body-metrics/measurement-chart.tsx` · **Type**: Island (`client:visible`) · **Page**: `/profile/measurements`

| Prop | Type | Description |
|------|------|-------------|
| `metric` | `BodyMetricKey` | Initial metric |
| `series` | `Record<BodyMetricKey, { date: string; value: number }[]>` | Display units |
| `unit` | `string` | `kg`, `lb`, `cm`, `in`, `%` |

- Metric selector + ranges 30 d / 3 m / 1 a / todo; body weight adds a 7-entry moving average ([FR-BM-005](../prd/features/body-metrics.md#fr-bm-005)).

### LatestMeasurementsCard

**File**: `src/components/body-metrics/latest-measurements-card.astro` · **Type**: Static · **Pages**: `/profile`, `/profile/measurements`

| Prop | Type | Description |
|------|------|-------------|
| `latest` | `{ weight: number \| null; bodyFatPct: number \| null; measuredOn: Date } \| null` | |
| `delta30d` | `{ weight: number \| null; bodyFatPct: number \| null } \| null` | vs the closest entry ≥ 30 days earlier |
| `weightUnit` | `'kg' \| 'lbs'` | |

- "78.4 kg · 18 %" with "−1.8 kg en 30 días" ([FR-BM-006](../prd/features/body-metrics.md#fr-bm-006)); empty state links to the form.

---

## Photo Compare

Feature: [private-photos](../prd/features/private-photos.md) FR-PP-008 … FR-PP-010 · Story [11.3](../stories/phase-2/round-11/story-11.3.md). Owner-only ([ADR-005](./decisions/005-private-photos.md), [ADR-023](./decisions/023-body-metrics-privacy.md)).

### PhotoCompare

**File**: `src/components/photos/photo-compare.tsx` · **Type**: Island (`client:load`) · **Page**: `/photos/compare`

| Prop | Type | Description |
|------|------|-------------|
| `photos` | `{ id: string; url: string; takenOn: string; bodyWeightKg: number \| null }[]` | Owner's photos; body weight within ±3 days ([FR-PP-009](../prd/features/private-photos.md#fr-pp-009)) |
| `leftId` | `string` | Default oldest (or from gallery multi-select, FR-PP-010) |
| `rightId` | `string` | Default newest |
| `weightUnit` | `'kg' \| 'lbs'` | |

- Modes **Lado a lado** (two columns, date under each) and **Deslizador** (overlay, draggable vertical divider, keyboard ←/→ support) ([FR-PP-008](../prd/features/private-photos.md#fr-pp-008)). Header "N días entre fotos"; *Intercambiar*; weight and Δ under each photo when available.
- At 360 px side-by-side uses 2 × 172 px columns; the slider handle is 44 px wide.

---

## Social

Feature: [social](../prd/features/social.md) FR-SO-001 … FR-SO-009 · Stories [12.1](../stories/phase-2/round-12/story-12.1.md), [12.2](../stories/phase-2/round-12/story-12.2.md). Rules: [ADR-024](./decisions/024-social-interactions.md). Never shows photos, body metrics, readiness or nutrition.

### FeedList

**File**: `src/components/social/feed-list.astro` · **Type**: Static · **Pages**: `/dashboard` (below the next workout), `/family/[user_id]` ([FR-PV-007](../prd/features/public-view.md#fr-pv-007))

| Prop | Type | Description |
|------|------|-------------|
| `items` | `FeedItem[]` | 20 per page, `completed_at` desc |
| `nextPageHref` | `string \| null` | *Cargar más* (`?page=N`) |
| `viewerId` | `string` | Hides the like button on own workouts |

- Empty state "Cuando tu familia entrene, lo verás aquí" ([FR-SO-001](../prd/features/social.md#fr-so-001)). Decision: *Cargar más* is a plain link to the next page, no infinite scroll. (Simplest; works without JS.)

### FeedCard

**File**: `src/components/social/feed-card.astro` · **Type**: Static (contains the `LikeButton` island)

| Prop | Type | Description |
|------|------|-------------|
| `item` | `FeedItem` | Author, relative time, workout name, duration, volume, sets, PR count, first 3 exercises with best set, likes, comments count |
| `weightUnit` | `'kg' \| 'lbs'` | Viewer's unit |
| `isOwn` | `boolean` | |

- Layout per [FR-SO-002](../prd/features/social.md#fr-so-002); the whole card links to `/workouts/[id]` except the like and comment buttons (each ≥ 44 px).

### WorkoutDetail

**File**: `src/components/social/workout-detail.astro` · **Type**: Static · **Page**: `/workouts/[id]`

| Prop | Type | Description |
|------|------|-------------|
| `workout` | `WorkoutAggregate` view | Header stats, exercises, every set with labels and PR badges, notes |
| `isOwner` | `boolean` | *Editar* / *Repetir* / *Eliminar* ([FR-PR-018](../prd/features/progress.md#fr-pr-018)) |
| `canCopyRoutine` | `boolean` | Other user's workout with `routine_day_id` → *Guardar rutina* ([FR-SO-009](../prd/features/social.md#fr-so-009)) |

- Read-only ([FR-SO-003](../prd/features/social.md#fr-so-003)). Hosts `LikeButton` and `CommentList`. *Repetir* is a tiny inline script that generates the UUID and calls `PUT /api/workouts/[id]` (`mode: 'repeat'`) ([edit-workout.flow.md](./contexts/workout-tracking/flows/edit-workout.flow.md)).

### LikeButton

**File**: `src/components/social/like-button.tsx` · **Type**: Island (`client:visible`)

| Prop | Type | Description |
|------|------|-------------|
| `workoutId` | `string` | |
| `liked` | `boolean` | Viewer's state |
| `count` | `number` | |
| `disabled` | `boolean` | Own workout → not rendered at all |

- ❤️ toggles optimistically and rolls back on error ([FR-SO-004](../prd/features/social.md#fr-so-004)). Tapping the count opens the likers list. 44 × 44 px.

### CommentList

**File**: `src/components/social/comment-list.tsx` · **Type**: Island (`client:visible`) · **Page**: `/workouts/[id]`

| Prop | Type | Description |
|------|------|-------------|
| `workoutId` | `string` | |
| `comments` | `{ id: string; author: string; body: string; createdAt: string; edited: boolean; canEdit: boolean; canDelete: boolean }[]` | Oldest → newest |

- Plain text, escaped ([ADR-024 §3](./decisions/024-social-interactions.md)). Author edit/delete; workout owner delete ([FR-SO-005](../prd/features/social.md#fr-so-005)). "(editado)". Renders `CommentForm` at the bottom.

### CommentForm

**File**: `src/components/social/comment-form.tsx` · **Type**: Island child (of `CommentList`)

| Prop | Type | Description |
|------|------|-------------|
| `workoutId` | `string` | |
| `initialBody` | `string` | Edit mode |
| `onSubmitted` | `(c: Comment) => void` | |

- Textarea 1–500 characters with a live counter; *Enviar* disabled when empty or offline. Sticky above the keyboard on mobile.

### ShareImageButton

**File**: `src/components/social/share-image-button.tsx` · **Type**: Island (`client:visible`) · **Used by**: `WorkoutSummary` v2, `WorkoutDetail` (own completed only)

| Prop | Type | Description |
|------|------|-------------|
| `share` | `{ name: string; date: string; durationMin: number; volume: number; sets: number; prs: string[]; exercises: { name: string; sets: number; best: string }[] }` | Up to 3 PRs and 6 exercises |
| `weightUnit` | `'kg' \| 'lbs'` | |

- Renders a 1080 × 1350 PNG on a canvas (light theme), then Web Share API with files, else downloads it ([FR-SO-008](../prd/features/social.md#fr-so-008)). Never includes photos or body metrics.
