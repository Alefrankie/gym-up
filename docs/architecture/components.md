# UI Components

Parent: [./readme.md](./readme.md) · Up: [../README.md](../README.md)

Component-level detail. For page-level behavior see feature files in [../prd/features/](../prd/features/).

---

## Conventions

### Filenames: kebab-case

All component filenames are **kebab-case**, regardless of framework. Do not use PascalCase for filenames even when the framework conventionally does so.

| Framework | ❌ PascalCase | ✅ kebab-case |
|-----------|---------------|---------------|
| Astro     | `Navigation.astro` | `navigation.astro` |
| Astro     | `ExerciseCard.astro` | `exercise-card.astro` |
| React     | `RestTimer.tsx` | `rest-timer.tsx` |
| Svelte    | `FamilyMemberCard.svelte` | `family-member-card.svelte` |
| TS module | `AuthForm.ts` | `auth-form.ts` |

**Why:** consistent filesystem layout across frameworks makes glob paths, code search, and refactors predictable. PascalCase is reserved for the *exported class/function name inside the file* (e.g. `export function RestTimer(...)` inside `rest-timer.tsx`).

**Implementation note:** when a framework requires a 1:1 filename-to-export mapping for routing or auto-registration (rare in this project), keep the export PascalCase but the file kebab-case.

### Other rules

- One component per file.
- Props interface defined inline above the component (no separate `.types.ts` for simple cases).
- Repository access goes through the abstract `XxxRepository` per [ADR-007](./decisions/007-repository-pattern.md); never import a concrete Supabase/SQLite client from a component.

---

## Navigation

**File**: `src/components/navigation.astro`
**Feature**: [workout-tracking](../prd/features/workout-tracking.md)

| Icon | Label | Route |
|------|-------|-------|
| 🏠 | Home | `/dashboard` |
| 📋 | History | `/history` |
| 📊 | Progress | `/progress` |
| 📷 | Photos | `/photos` |
| 👥 | Family | `/family` |
| ⚙️ | Settings | `/settings` |

Active link highlighted. Hidden on landing/login/register.

---

## ExerciseCard

**File**: `src/components/exercise-card.astro`
**Feature**: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-008, FR-WT-009, FR-WT-010
**Refined in**: [Story 2.7](../stories/phase-1/round-2/story-2.7-ux-reword.md)

| Prop | Type | Description |
|------|------|-------------|
| `exerciseName` | `string` | Display name |
| `targetSets` | `number` | Target sets from routine |
| `targetReps` | `number` | Target reps from routine |
| `exerciseId` | `string` | UUID |
| `workoutId` | `string` | Current workout UUID (reserved for Story 2.4 / 2.5) |
| `weightUnit` | `'kg' \| 'lbs'` | User preference [ADR-006](./decisions/006-kg-storage.md) |
| `initialEntries` | `WorkoutEntry[]` (optional) | Saved entries to pre-fill rows on resume. Added in Story 2.4. Defaults to `[]`. |

### Row anatomy (per set, top → bottom)

1. **Reps** (number input) — pre-filled from previous row when empty.
2. **Peso (kg/lbs)** (number input, step 0.5) — pre-filled from previous row when empty.
3. **Hecho** (checkbox) — primary completion signal. Tapping it is the canonical "I did this set" action; also kicks off the rest timer in Story 2.5.
4. **Notas** (text input) — collapsed behind a "✏️ nota" toggle by default (Story 2.7). Same `name` attribute as before, so the auto-save payload is unchanged.

### UX behaviors (Story 2.7)

- **Pre-fill propagation**: typing in set N's reps or weight copies the value to set N+1 if N+1 is empty. First row of a card uses `targetReps` as placeholder. The `+ Añadir set` clone also inherits from the previous row.
- **Collapsed notes**: notes field hidden by default; reveals on tap of the toggle. The input keeps the same `name` (`entries[N][notes]`) so the data model and auto-save (Story 2.4) are unaware.
- **Primary check**: the "Hecho" checkbox is visually emphasized as the row's primary action.
- **Cap**: `WorkoutEntryRules.MaxSetsPerExercise` (10) — `+ Añadir set` hides at the cap.

### Form contract (unchanged)

Each rendered row emits inputs with names `entries[N][reps]`, `entries[N][weight]`, `entries[N][completed]`, `entries[N][notes]`, `entries[N][exercise_id]`. The auto-save module from Story 2.4 reads these names verbatim; UX changes in Story 2.7 never alter them.

### Out of scope

- No domain logic, no use case, no repository.
- The rest timer (Story 2.5) and workout summary (Story 2.6) are not modified by Story 2.7.

---

## RestTimer

**File**: `src/components/rest-timer.tsx`
**Feature**: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-011

React island. Client-side only, no DB persistence.

| Prop | Type | Description |
|------|------|-------------|
| `defaultSeconds` | `number` | Default rest time (90) |

Starts on set checkmark tap. Countdown 90s. +30s extend. Skip. Vibration/sound on end.

---

## WorkoutSummary

**File**: `src/components/workout-summary.astro`
**Feature**: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-012

| Prop | Type | Description |
|------|------|-------------|
| `exercises` | `number` | Total exercises completed |
| `totalSets` | `number` | Total sets logged |
| `totalVolume` | `number` | Sum of (sets × reps × weight) |
| `duration` | `string` | Time elapsed |

---

## ProgressChart

**File**: `src/components/progress-chart.tsx`
**Feature**: [progress](../prd/features/progress.md) FR-PR-002

React island via Chart.js [ADR-002](./decisions/002-chartjs-react-island.md).

| Prop | Type | Description |
|------|------|-------------|
| `exerciseId` | `string` | Exercise to chart |
| `exerciseName` | `string` | Display name |
| `data` | `ChartData[]` | `{date, weight, volume}` |
| `type` | `'weight' \| 'volume'` | Chart type |
| `weightUnit` | `'kg' \| 'lbs'` | Display unit |

---

## PhotoGallery

**File**: `src/components/photo-gallery.astro`
**Feature**: [private-photos](../prd/features/private-photos.md) FR-PP-005

| Prop | Type | Description |
|------|------|-------------|
| `photos` | `Photo[]` | `{id, url, date, caption}` |
| `isOwner` | `boolean` | Ownership check |

Grid layout. Tap → fullscreen. Delete option. Photos private per [ADR-005](./decisions/005-private-photos.md).

---

## PhotoUpload

**File**: `src/components/photo-upload.astro`
**Feature**: [private-photos](../prd/features/private-photos.md) FR-PP-001

| Prop | Type | Description |
|------|------|-------------|
| `workoutId` | `string \| null` | Optional workout link |

File input (jpg, png, webp). Max 5MB. Client-side resize. Upload to `progress-photos/{user_id}/{timestamp}.jpg`. Caption optional.

---

## FamilyMemberCard

**File**: `src/components/family-member-card.astro`
**Feature**: [public-view](../prd/features/public-view.md) FR-PV-005

| Prop | Type | Description |
|------|------|-------------|
| `displayName` | `string` | User's name |
| `routineType` | `'hombre' \| 'mujer'` | Routine type |
| `totalWorkouts` | `number` | Total completed |
| `currentStreak` | `number` | Consecutive days |
| `lastWorkout` | `string \| null` | Last workout date |

---

## AuthForm

**File**: `src/components/auth-form.astro`
**Feature**: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-001

| Prop | Type | Description |
|------|------|-------------|
| `mode` | `'login' \| 'register'` | Form mode |

**Register**: display name, email, password, routine type, weight unit.
**Login**: email, password.
