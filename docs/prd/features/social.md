# Feature — Social (Family Feed)

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- Context: [architecture/contexts/social/readme.md](../../architecture/contexts/social/readme.md)
- Decisions: [ADR-024](../../architecture/decisions/024-social-interactions.md), [ADR-004](../../architecture/decisions/004-rls-visibility.md)
- Stories: [Round 12](../../stories/phase-2/round-12/readme.md)

Phase 2. Hevy's home feed adapted to the family model: see siblings' workouts as they finish them, like, comment, copy their routines, share your own workout as an image.

---

## Functional Requirements

### Feed

#### FR-SO-001

The **Inicio** tab shows, below the next-workout card, the **family feed**: completed workouts of all other users, ordered by `completed_at` desc. 20 per page with *Cargar más*. Empty state: "Cuando tu familia entrene, lo verás aquí".

#### FR-SO-002

Feed card:

- avatar initial + display name, relative time ("hace 2 h");
- workout name;
- duration · volume (viewer's unit) · sets;
- 🏆 PR count (if > 0);
- the first 3 exercises with their best set ("Bench Press — 3 × 80 kg × 8"), plus "+N ejercicios";
- ❤️ like count, 💬 comment count.

It never shows photos, body metrics, readiness or nutrition ([ADR-024 §6](../../architecture/decisions/024-social-interactions.md)).

#### FR-SO-003

Tapping a card opens `/workouts/[id]`, the read-only workout detail: header stats, every exercise with all sets (set type labels, PR badges), workout notes, likes and comments.

### Likes & Comments

#### FR-SO-004

❤️ toggles like/unlike on another user's workout (optimistic UI). A user cannot like their own workout. Tapping the count lists who liked.

#### FR-SO-005

Comments on the workout detail: oldest → newest, 1–500 characters, plain text. The author can edit or delete their comment; the workout owner can delete any comment ([ADR-024 §3](../../architecture/decisions/024-social-interactions.md)). Edited comments show "(editado)".

#### FR-SO-006

`/activity` lists likes and comments on my workouts, newest first ("Ana le dio ❤️ a Pierna A", "Luis comentó: …"). The **Inicio** tab icon shows a dot while unseen activity exists. Opening `/activity` marks everything seen (`activity_seen_at = now`).

#### FR-SO-007

My own workout detail shows the likes and comments I received, with the same comment actions.

### Share

#### FR-SO-008

*Compartir* (own completed workouts only) renders a 1080 × 1350 PNG client-side (canvas) with: app logo, workout name, date, duration, volume, sets, PRs (up to 3), and up to 6 exercises with sets × best set. Light theme. It uses the Web Share API (files) when available, otherwise downloads `gymup-{date}.png`. No body metrics or photos.

### Copy

#### FR-SO-009

On another user's workout detail with `routine_day_id`, *Guardar rutina* copies that routine into one of my programs ([FR-RT-006](./routines.md#fr-rt-006)). On any workout, *Repetir* is **not** offered for others' workouts (only own, [FR-WT-018](./workout-tracking.md#fr-wt-018)).

---

## Data

| Table | Access |
|-------|--------|
| `workouts`, `workout_exercises`, `workout_entries` | Read all (existing [ADR-004](../../architecture/decisions/004-rls-visibility.md)) |
| `workout_likes` | Read all; insert/delete own |
| `workout_comments` | Read all; insert/update/delete own; delete by workout owner |
| `profiles` | `activity_seen_at`: write own |

## Components

| Component | Spec |
|-----------|------|
| `FeedList`, `FeedCard` | [components.md → Social](../../architecture/components.md#social) |
| `WorkoutDetail` | [components.md → Social](../../architecture/components.md#social) |
| `LikeButton`, `CommentList`, `CommentForm` | [components.md → Social](../../architecture/components.md#social) |
| `ShareImageButton` | [components.md → Social](../../architecture/components.md#social) |
