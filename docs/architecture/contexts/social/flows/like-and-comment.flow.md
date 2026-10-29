# Like and Comment Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-SO-004 … FR-SO-007](../../../../prd/features/social.md#fr-so-004)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [12.1](../../../../stories/phase-2/round-12/story-12.1.md) |
| Decisions | [ADR-024](../../../decisions/024-social-interactions.md) |

## Happy Path

### Step 1 - Like a sibling's workout

On a `FeedCard` or `/workouts/{id}` of another user, the user taps ❤️. `LikeButton` flips to filled and increments the count **immediately** (optimistic), then sends `POST /api/workouts/{id}/likes`.

### Step 2 - Persist the like

The endpoint calls `ToggleLikeUseCase.execute({ workoutId, userId, liked: true })`:

1. `FeedQueryRepository.findWorkoutHeader` → must exist and be `completed`.
2. Owner check → not the viewer.
3. `LikeRepository.upsert(workoutId, userId)` (`ON CONFLICT DO NOTHING`; Supabase RLS `workout_likes_insert_own` also blocks self-likes).
4. Returns `{ liked: true, likeCount }`. The island replaces its optimistic count with the server count.

### Step 3 - Unlike

Tapping again sends `DELETE /api/workouts/{id}/likes` (`liked: false`) → `LikeRepository.delete`. Same optimistic pattern.

### Step 4 - See who liked

Tapping the count opens a sheet that calls `GET /api/workouts/{id}/likes` → `ListLikersUseCase` → display names, newest first.

### Step 5 - Write a comment

On `/workouts/{id}`, `CommentForm` shows a textarea with a "N/500" counter. *Publicar* sends `POST /api/workouts/{id}/comments` with `{ body }`. `AddCommentUseCase` checks visibility, `validateCommentBody` trims and counts code points (1–500), then `CommentRepository.create`. It returns `CommentView` (201). `CommentList` appends it at the bottom (oldest → newest) and clears the form. The workout owner can comment on their own workout too (FR-SO-007).

### Step 6 - Edit a comment

The author taps *Editar* on their comment → inline textarea → *Guardar* sends `PATCH /api/comments/{id}`. `EditCommentUseCase` checks authorship, validates, updates `body` and `updated_at`. The comment shows "(editado)".

### Step 7 - Delete a comment

The author, or the **workout owner** (moderation), taps *Eliminar* → confirm "¿Eliminar comentario?" → `DELETE /api/comments/{id}` → `DeleteCommentUseCase` → 204. The comment disappears.

### Step 8 - Owner sees activity

The workout owner's Inicio tab shows a dot (`HasUnseenActivityUseCase`: a like or comment by another user with `created_at > activity_seen_at`). Opening `/activity` lists "Ana le dio ❤️ a Pierna A" / "Luis comentó: …" newest first, highlights the new ones (`isNew`), then calls `MarkActivitySeenUseCase` (`activity_seen_at = now`). The dot disappears on the next render.

---

## Failure: Like Own Workout

The button is hidden on own workouts (`canLike = false`). A crafted request → `SelfLikeError` → 403. In Supabase, RLS refuses the insert even if the use case were bypassed.

## Failure: Optimistic Like Rejected

The server answers 4xx/5xx or the network fails. The island reverts the heart and count to their previous state and shows a short toast "No se pudo guardar el me gusta".

## Failure: Comment Too Long or Empty

Empty / whitespace-only body, or > 500 code points → `CommentBodyInvalidError` → 400. The form keeps the text and shows "El comentario debe tener entre 1 y 500 caracteres". *Publicar* is disabled client-side when the trimmed body is empty.

## Failure: Edit or Delete Without Permission

A user edits someone else's comment, or deletes a comment on a workout they do not own and did not write → `CommentPermissionError` → 403. The buttons are not rendered for them (`canEdit` / `canDelete` false). In Supabase a denied delete affects 0 rows; the repository turns that into the same error.

## Failure: Workout Not Visible

The workout was deleted, or is another user's `in_progress` workout → `WorkoutNotVisibleError` → 404 for like, likers and comment endpoints.

## Edge Case: Double Tap

Two quick taps send `POST` then `DELETE`. Both are idempotent target states, processed in order; the final state matches the last tap.

## Edge Case: Comment With Emoji

"💪💪" counts as 2 characters (code points), matching Postgres `char_length`. The counter in the form uses the same rule.

## Edge Case: Own Comment On Own Workout

It is shown in the comment list but is **not** an activity item and does not light the dot.

## Edge Case: Workout Deleted

Deleting a workout cascades its likes and comments (FK `ON DELETE CASCADE`). The related activity items disappear.
