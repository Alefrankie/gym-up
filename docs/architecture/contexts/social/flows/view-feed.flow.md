# View Feed Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-SO-001 … FR-SO-003](../../../../prd/features/social.md#fr-so-001)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [12.1](../../../../stories/phase-2/round-12/story-12.1.md) |
| Decisions | [ADR-024](../../../decisions/024-social-interactions.md), [ADR-004](../../../decisions/004-rls-visibility.md) |

## Happy Path

### Step 1 - Open Inicio

The user opens `/dashboard` (tab **Inicio**). SSR resolves the session, renders the next-workout card ([ADR-019](../../../decisions/019-rotation-scheduling-and-onboarding.md)) and, below it, calls `getFeedUseCase.execute({ viewerId })`.

### Step 2 - Load the first page

`GetFeedUseCase` asks `FeedQueryRepository.listCompletedPage` for `SocialRules.FeedPageSize + 1` (21) completed workouts with `user_id <> viewer`, ordered by `(completed_at DESC, id DESC)`. In parallel it loads, for those ids only: completed non-deleted sets, like counts, comment counts, the viewer's likes and PR counts (`PrCountPort.countByWorkouts`). It returns 20 `FeedItem`s and `nextCursor` (the 21st row exists → cursor of the 20th).

### Step 3 - Render cards

`FeedList` (island, `client:visible`) receives the page as a prop. Each `FeedCard` shows (FR-SO-002):

- avatar initial + display name, "hace 2 h";
- workout name;
- duration · volume (viewer's unit) · sets;
- 🏆 N (only if > 0);
- up to 3 exercises: "Bench Press — 3 × 80 kg × 8" (set count × best set, see `pickBestSet`), then "+N ejercicios";
- ❤️ count (filled when `likedByMe`), 💬 count.

No photos, body metrics, readiness or nutrition are present in the payload (ADR-024 §6).

### Step 4 - Cargar más

At the end of the list, *Cargar más* calls `GET /api/feed?cursor=<nextCursor>`. The endpoint decodes the cursor and runs Step 2 from that position. New cards are appended; the button disappears when `nextCursor` is `null`.

### Step 5 - Open a workout

Tapping a card (outside ❤️) navigates to `/workouts/{id}`. SSR calls `getWorkoutDetailUseCase.execute({ workoutId, viewerId })` and renders `WorkoutDetail`: header stats, every exercise with all completed sets (labels `W`/`D`/`F`/1..n, 🏆 badges from `PrCountPort.listByWorkout`), superset grouping, workout notes, likes and comments ([like-and-comment.flow.md](./like-and-comment.flow.md)). On another user's workout with a routine, *Guardar rutina* is shown (FR-SO-009).

---

## Edge Case: Empty Feed

No other user has a completed workout. `items = []`. The section shows "Cuando tu familia entrene, lo verás aquí". No *Cargar más*.

## Edge Case: New Workout While Scrolling

A sibling finishes a workout between page 1 and *Cargar más*. Keyset pagination continues strictly after the last loaded card, so the new workout neither duplicates nor shifts cards. It appears at the top on the next visit to Inicio.

## Edge Case: Workout Edited or Deleted After Loading

The owner edits a workout ([FR-WT-039](../../../../prd/features/workout-tracking.md#fr-wt-039)): aggregates and PR counts are recomputed on the next load (no stored state). If it is deleted, tapping its card returns 404 → the detail page shows "Este entrenamiento ya no existe" with a link back to Inicio.

## Edge Case: Phase 1 Workout

Phase 1 workouts were backfilled to `workout_exercises` and named from their routine day ([ADR-016 §6](../../../decisions/016-workout-data-model-v2.md)). They render like any other card. Their sets are all `normal`.

## Edge Case: Own In-Progress Workout Detail

The owner opens `/workouts/{id}` for their own `in_progress` workout: `WorkoutInProgressError` → redirect to `/workout/{id}` (live island). Another user's `in_progress` workout → 404.

## Failure: Invalid Cursor

`GET /api/feed?cursor=garbage` → `InvalidCursorError` → 400. The island shows "No se pudo cargar más" with *Reintentar* (reloads from the last valid cursor).

## Failure: Offline

`/api/feed` fails with a network error. The island keeps the loaded cards and shows "Sin conexión" ([ADR-025 §1](../../../decisions/025-offline-live-workout.md)). The feed is never cached by the service worker.
