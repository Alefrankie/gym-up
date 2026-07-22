# UI Components

Parent: [./readme.md](./readme.md) · Up: [../README.md](../README.md)

Component-level detail. For page-level behavior see feature files in [../prd/features/](../prd/features/).

---

## Navigation

**File**: `src/components/Navigation.astro`
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

**File**: `src/components/ExerciseCard.astro`
**Feature**: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-008

| Prop | Type | Description |
|------|------|-------------|
| `exerciseName` | `string` | Display name |
| `targetSets` | `number` | Target sets from routine |
| `targetReps` | `number` | Target reps from routine |
| `exerciseId` | `string` | UUID |
| `workoutId` | `string` | Current workout UUID |
| `weightUnit` | `'kg' \| 'lbs'` | User preference [ADR-006](./decisions/006-kg-storage.md) |

Pre-populated with target sets. Each set: reps, weight, checkmark. Checkmark → starts rest timer. Notes field optional. Auto-save on change (debounce 500ms).

---

## RestTimer

**File**: `src/components/RestTimer.tsx`
**Feature**: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-011

React island. Client-side only, no DB persistence.

| Prop | Type | Description |
|------|------|-------------|
| `defaultSeconds` | `number` | Default rest time (90) |

Starts on set checkmark tap. Countdown 90s. +30s extend. Skip. Vibration/sound on end.

---

## WorkoutSummary

**File**: `src/components/WorkoutSummary.astro`
**Feature**: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-012

| Prop | Type | Description |
|------|------|-------------|
| `exercises` | `number` | Total exercises completed |
| `totalSets` | `number` | Total sets logged |
| `totalVolume` | `number` | Sum of (sets × reps × weight) |
| `duration` | `string` | Time elapsed |

---

## ProgressChart

**File**: `src/components/ProgressChart.tsx`
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

**File**: `src/components/PhotoGallery.astro`
**Feature**: [private-photos](../prd/features/private-photos.md) FR-PP-005

| Prop | Type | Description |
|------|------|-------------|
| `photos` | `Photo[]` | `{id, url, date, caption}` |
| `isOwner` | `boolean` | Ownership check |

Grid layout. Tap → fullscreen. Delete option. Photos private per [ADR-005](./decisions/005-private-photos.md).

---

## PhotoUpload

**File**: `src/components/PhotoUpload.astro`
**Feature**: [private-photos](../prd/features/private-photos.md) FR-PP-001

| Prop | Type | Description |
|------|------|-------------|
| `workoutId` | `string \| null` | Optional workout link |

File input (jpg, png, webp). Max 5MB. Client-side resize. Upload to `progress-photos/{user_id}/{timestamp}.jpg`. Caption optional.

---

## FamilyMemberCard

**File**: `src/components/FamilyMemberCard.astro`
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

**File**: `src/components/AuthForm.astro`
**Feature**: [workout-tracking](../prd/features/workout-tracking.md) FR-WT-001

| Prop | Type | Description |
|------|------|-------------|
| `mode` | `'login' \| 'register'` | Form mode |

**Register**: display name, email, password, routine type, weight unit.
**Login**: email, password.
