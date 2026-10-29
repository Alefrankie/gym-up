# Social (Family Feed) Context

Parent: [../readme.md](../readme.md) · PRD: [../../../prd/features/social.md](../../../prd/features/social.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |

## Purpose

Hevy's home feed adapted to the family model ([ADR-024](../../decisions/024-social-interactions.md)): completed workouts of every other user, a read-only workout detail, likes, comments, an activity inbox, copying a sibling's routine, and a share image of my own workout. There is no follow graph: the family is the graph.

The context owns two tables, `workout_likes` and `workout_comments`, and one profile column, `profiles.activity_seen_at` ([database-schema.md → Phase 2 Migrations, 010](../../database-schema.md#phase-2-migrations)). Everything else it shows is **read** from `workouts`, `workout_exercises`, `workout_entries`, `exercises` and `profiles` (read-all per [ADR-004](../../decisions/004-rls-visibility.md)). It never writes workouts.

| Requirement | Story |
|---|---|
| [FR-SO-001](../../../prd/features/social.md#fr-so-001) … [FR-SO-007](../../../prd/features/social.md#fr-so-007), [FR-SO-009](../../../prd/features/social.md#fr-so-009) | [12.1](../../../stories/phase-2/round-12/story-12.1.md) |
| [FR-SO-008](../../../prd/features/social.md#fr-so-008) (share image) | [12.2](../../../stories/phase-2/round-12/story-12.2.md) |
| [FR-PV-007](../../../prd/features/public-view.md#fr-pv-007) (member workouts list reuses the feed query) | [12.1](../../../stories/phase-2/round-12/story-12.1.md), see [public-view → Phase 2](../public-view/readme.md#phase-2) |

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/social/domain/`. Types derive from Drizzle `@db/schema`; the context does not import other contexts' domain files (it keeps local aliases, like `public-view/domain/member.ts`).

### Drizzle tables (`db/schema.ts`)

```ts
// db/schema.ts — additions for migration 010 (story 12.1)
import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const workoutLikes = sqliteTable(
  'workout_likes',
  {
    workoutId: text('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.workoutId, t.userId] }), index('idx_workout_likes_workout').on(t.workoutId)],
);
export type WorkoutLike = typeof workoutLikes.$inferSelect;

export const workoutComments = sqliteTable(
  'workout_comments',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    workoutId: text('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    body: text('body').notNull(), // 1–500 chars, validated in the domain (CHECK only in Postgres)
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('idx_workout_comments_workout').on(t.workoutId, t.createdAt)],
);
export type WorkoutComment = typeof workoutComments.$inferSelect;
export type NewWorkoutComment = typeof workoutComments.$inferInsert;

// profiles gains:
//   activitySeenAt: integer('activity_seen_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
```

### `social.types.ts`

```ts
// src/lib/contexts/social/domain/social.types.ts
import type { WorkoutEntry, Exercise } from '@db/schema';

export type SetType = WorkoutEntry['setType'];          // 'normal' | 'warmup' | 'drop' | 'failure' (ADR-016)
export type ExerciseType = Exercise['exerciseType'];    // 7 values (ADR-017)
export type RecordType = string;                         // ADR-020 keys, owned by progress ('best_1rm', …)

/** One completed, non-deleted set as read by FeedQueryRepository. Weights in kg. */
export interface SocialSetRow {
  workoutId: string;
  workoutExerciseId: string;
  position: number;              // workout_exercises.position
  supersetGroup: number | null;
  exerciseNotes: string | null;
  exerciseId: string;
  exerciseName: string;          // English (OQ-001)
  exerciseType: ExerciseType;
  entryId: string;
  setNumber: number;
  setType: SetType;
  weightKg: number;              // may be < 0 for assisted_bodyweight
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  rpe: number | null;
}

/** Workout header as read by FeedQueryRepository. Never contains readiness_score or is_deload. */
export interface SocialWorkoutRow {
  workoutId: string;
  ownerId: string;
  ownerDisplayName: string;
  name: string;
  notes: string | null;
  status: 'in_progress' | 'completed';
  routineDayId: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface BestSet {
  weightKg: number;
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
}

export interface ExerciseSummary {
  exerciseName: string;
  exerciseType: ExerciseType;
  setCount: number;              // completed sets of this workout exercise
  bestSet: BestSet | null;
}

/** Feed card read model (FR-SO-002). */
export interface FeedItem {
  workoutId: string;
  ownerId: string;
  ownerDisplayName: string;
  workoutName: string;
  completedAt: Date;
  durationSeconds: number;       // completedAt − startedAt (ADR-016 §2)
  volumeKg: number;
  setCount: number;
  prCount: number;
  exercises: ExerciseSummary[];  // first SocialRules.FeedExercisePreview, by position
  extraExerciseCount: number;    // "+N ejercicios"
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;     // opaque, see FeedCursor
}

/** Keyset cursor: (completedAt DESC, workoutId DESC). Encoded as `${ms}_${workoutId}`. */
export interface FeedCursor {
  completedAt: Date;
  workoutId: string;
}

export interface DetailSet {
  entryId: string;
  label: string;                 // 'W' | 'D' | 'F' | '1', '2'… (ADR-016 §4)
  setType: SetType;
  weightKg: number;
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  prTypes: RecordType[];         // PR badges (FR-PR-010)
}

export interface DetailExercise {
  workoutExerciseId: string;
  position: number;
  supersetGroup: number | null;
  exerciseName: string;
  exerciseType: ExerciseType;
  notes: string | null;
  sets: DetailSet[];
}

export interface CommentView {
  id: string;
  authorId: string;
  authorDisplayName: string;
  body: string;                  // plain text, rendered escaped
  createdAt: Date;
  edited: boolean;               // updatedAt > createdAt → "(editado)"
  canEdit: boolean;              // viewer is author
  canDelete: boolean;            // viewer is author or workout owner
}

/** Workout detail read model (FR-SO-003, FR-SO-007). */
export interface WorkoutDetailView {
  header: Omit<FeedItem, 'exercises' | 'extraExerciseCount' | 'commentCount'> & { notes: string | null; startedAt: Date };
  exercises: DetailExercise[];
  prs: Array<{ exerciseName: string; recordType: RecordType; value: number }>;
  comments: CommentView[];
  isOwner: boolean;
  canLike: boolean;              // !isOwner
  canSaveRoutine: boolean;       // !isOwner && routineDayId !== null (FR-SO-009)
  targetPrograms: Array<{ id: string; name: string }>; // only when canSaveRoutine
}

export interface Liker {
  userId: string;
  displayName: string;
  likedAt: Date;
}

export type ActivityKind = 'like' | 'comment';

/** One entry of /activity (FR-SO-006). */
export interface ActivityItem {
  kind: ActivityKind;
  key: string;                   // like: `${workoutId}:${userId}`, comment: comment id
  actorId: string;
  actorDisplayName: string;
  workoutId: string;
  workoutName: string;
  commentPreview: string | null; // first SocialRules.CommentPreviewLength chars
  createdAt: Date;
  isNew: boolean;                // createdAt > activity_seen_at at load time
}

/** Data the share island needs to draw the PNG (FR-SO-008). Owner-only. */
export interface ShareImageData {
  workoutName: string;
  completedAt: Date;
  timezone: string;              // owner's profiles.timezone
  weightUnit: 'kg' | 'lbs';      // owner's unit
  durationSeconds: number;
  volumeKg: number;
  setCount: number;
  prCount: number;               // total, may exceed prs.length
  prs: Array<{ exerciseName: string; recordType: RecordType; value: number }>; // ≤ ShareImageRules.MaxPrs
  exercises: ExerciseSummary[];  // ≤ ShareImageRules.MaxExercises
  extraExerciseCount: number;
}
```

### `social.constants.ts`

```ts
// src/lib/contexts/social/domain/social.constants.ts

export const SocialRules = {
  FeedPageSize: 20,              // FR-SO-001, also FR-PV-007 and /activity
  CommentMin: 1,                 // code points, after trim (ADR-024 §3)
  CommentMax: 500,
  FeedExercisePreview: 3,        // FR-SO-002
  CommentPreviewLength: 80,      // /activity "Luis comentó: …"
} as const;

export const ShareImageRules = {
  WidthPx: 1080,
  HeightPx: 1350,
  MaxPrs: 3,
  MaxExercises: 6,
  FileNamePattern: 'gymup-{date}.png', // date = yyyy-mm-dd in owner timezone
} as const;

export const BestSetRules = {
  E1rmMinReps: 1,                // ADR-020 §2: e1RM only for 1–12 reps
  E1rmMaxReps: 12,
} as const;

export const ActivityKinds = {
  Like: 'like',
  Comment: 'comment',
} as const;
```

### Entities

- `Like` — `workout_likes` row. Identity `(workoutId, userId)`. Created and deleted, never updated.
- `Comment` — `workout_comments` row. Identity `id`. The author can change the body; `updatedAt` bumps on edit.

### Read models (derived, never stored)

- `FeedItem` — one completed workout of another user, with aggregates (FR-SO-002).
- `WorkoutDetailView` — full read-only workout with sets, labels, PR badges, likes and comments (FR-SO-003, FR-SO-007).
- `ActivityItem` — a like or comment someone else left on one of my workouts (FR-SO-006).
- `ShareImageData` — the numbers drawn on the share PNG (FR-SO-008).

### Value Objects

- `CommentBody` — trimmed plain text, `SocialRules.CommentMin`–`CommentMax` **code points** (`[...body].length`, which matches Postgres `char_length`; `string.length` would count an emoji as 2).
- `FeedCursor` — keyset `(completedAt, workoutId)`, encoded `${completedAt.getTime()}_${workoutId}`.
- `BestSet` — chosen by `pickBestSet` (rule below).

### Domain rules (`social.rules.ts`, pure functions)

All aggregates are computed in the domain from `SocialSetRow[]`, so SQLite and Supabase return identical numbers.

| Function | Rule |
|---|---|
| `summarizeWorkout(row, sets)` | `durationSeconds = completedAt − startedAt`. `setCount` = completed, non-deleted sets (all set types, like the live header FR-WT-024). `volumeKg = Σ max(0, weightKg) × (reps ?? 0)` over the same sets. Exercises are grouped by `workoutExerciseId` and ordered by `position`. |
| `pickBestSet(sets)` | Candidates = completed sets of one workout exercise with `setType ≠ 'warmup'` (warm-ups only when no other set exists). 1) highest e1RM (Epley `w × (1 + r/30)`, only `weightKg > 0` and `1 ≤ reps ≤ 12`); else 2) heaviest `weightKg`; else 3) most reps; else 4) longest `durationSeconds`; else 5) longest `distanceM`. Ties: heavier weight, then more reps, then lower `setNumber`. |
| `deriveSetLabels(sets)` | ADR-016 §4: warm-up `W`, drop `D`, failure `F`, normal = ordinal among the exercise's normal sets. |
| `validateCommentBody(raw)` | `trim()`, then code-point length in `[CommentMin, CommentMax]`, else `CommentBodyInvalidError`. Line breaks are kept. No markdown, no link embedding. |
| `encodeFeedCursor` / `decodeFeedCursor` | An invalid cursor throws `InvalidCursorError` (400). |

> Decision: feed volume never adds body weight for bodyweight exercises. Body weight is owner-only ([ADR-023](../../decisions/023-body-metrics-privacy.md)) and could be inferred from the number. Owner-only stats ([FR-PR-014](../../../prd/features/progress.md#fr-pr-014)) may therefore show a higher volume for the same workout.
>
> Decision: set counts include warm-ups everywhere (header and the "3 × …" exercise line), as in Hevy, so "sets" has one definition.

### Invariants

- Only `status = 'completed'` workouts are visible in the feed, in other users' detail, likes, comments and activity. Another user's `in_progress` workout is "not found" (404).
- The feed excludes the viewer's own workouts (ADR-024 §1). With an `authorId` filter (member profile, FR-PV-007), the feed shows exactly that author's workouts.
- **No self-like**: a user cannot like their own workout (`SelfLikeError`). The UI hides the button (Hevy). RLS enforces it too (`workout_likes_insert_own`).
- At most one like per `(workoutId, userId)`. Liking twice is a no-op; unliking a missing like is a no-op (idempotent for optimistic UI).
- A comment can be edited **only by its author**. It can be deleted by its author **or by the workout owner** (moderation, ADR-024 §3).
- Comment bodies are plain text, 1–500 code points after trim, rendered escaped (Astro `{body}` / React text node, never `set:html` / `dangerouslySetInnerHTML`).
- Activity lists only likes and comments by **other users** on **my** workouts. My own comment on my own workout is not activity.
- The activity dot shows while an activity item has `createdAt > profiles.activity_seen_at`. Opening `/activity` sets `activity_seen_at = now`.
- Share image data is available **only to the owner** of a completed workout (FR-SO-008).
- *Guardar rutina* is offered only on another user's workout with `routine_day_id IS NOT NULL`. *Repetir* is never offered on others' workouts (FR-SO-009).
- **Privacy exclusions** (ADR-024 §6, [ADR-005](../../decisions/005-private-photos.md), [ADR-023](../../decisions/023-body-metrics-privacy.md), [ADR-022](../../decisions/022-readiness-and-recovery.md), [ADR-026](../../decisions/026-weekly-ai-coach-summary.md)): no read model in this context ever contains photos, body measurements or body weight, `readiness_score` or readiness check-ins, `is_deload`, progression overrides, AI summaries, nutrition, e-mail or profile settings. Repositories list columns explicitly and never `select('*')` on `workouts` or `profiles`.
- Deleted sets and exercises (`deleted_at IS NOT NULL`, [ADR-025](../../decisions/025-offline-live-workout.md)) are excluded from every aggregate. Deleting a workout cascades its likes and comments.

### Errors (`social.errors.ts`)

| Error | HTTP |
|---|---|
| `WorkoutNotVisibleError` (missing, or another user's `in_progress`) | 404 |
| `WorkoutInProgressError` (owner opens own `in_progress` detail) | page redirects to `/workout/[id]` |
| `SelfLikeError` | 403 |
| `CommentBodyInvalidError` | 400 |
| `CommentNotFoundError` | 404 |
| `CommentPermissionError` (edit by non-author, delete by neither author nor workout owner) | 403 |
| `NotWorkoutOwnerError` (share data) | 403 |
| `RoutineNotCopyableError` (own workout, or no `routine_day_id`) | 400 |
| `InvalidCursorError` | 400 |

### Ports

Owned by this context (`domain/*.repository.ts`):

| Port | Methods |
|---|---|
| `FeedQueryRepository` | `listCompletedPage(query)`, `listCompletedSets(workoutIds)`, `findWorkoutHeader(workoutId)` |
| `LikeRepository` | `upsert(workoutId, userId)`, `delete(workoutId, userId)`, `countByWorkouts(workoutIds)`, `listLikedWorkoutIds(userId, workoutIds)`, `listLikers(workoutId)` |
| `CommentRepository` | `findById(id)`, `listByWorkout(workoutId)`, `create(input)`, `update(id, body, currentUserId)`, `delete(id, currentUserId)`, `countByWorkouts(workoutIds)` |
| `ActivityRepository` | `listForOwner(ownerId, cursor, limit)`, `findSeenAt(userId)`, `markSeen(userId, at)`, `hasUnseen(userId)` |

Consumed ports are provided by other contexts (see [contexts readme → Cross-context ports](../readme.md#cross-context-ports-phase-2)). The provider's readme is authoritative for the signature. Social needs exactly these methods:

| Port | Provided by | Used for | Methods social calls |
|---|---|---|---|
| `PrCountPort` | [progress](../progress/readme.md) ([ADR-020](../../decisions/020-personal-records.md)) | 🏆 count on cards; PR badges and PR list on the detail and share image | `countByWorkouts(workoutIds): Promise<Map<string, number>>`, `listByWorkout(workoutId): Promise<WorkoutSetPr[]>` (`{ entryId, exerciseName, recordType, value }`) |
| `RoutineCopyPort` | [routines](../routines/readme.md) ([ADR-018](../../decisions/018-user-owned-programs.md), [FR-RT-006](../../../prd/features/routines.md#fr-rt-006)) | *Guardar rutina* (FR-SO-009) | `listTargetPrograms(userId): Promise<Array<{ id; name }>>`, `copyRoutine({ routineDayId, targetProgramId \| null, currentUserId }): Promise<{ programId; routineDayId }>` (`null` → program "Copiadas") |

---

## Application

### Use Cases

Files: `src/lib/contexts/social/application/<verb-noun>.use-case.ts`. Date logic takes an injectable `now?: Date`.

| Use case | Purpose | Story | Status |
|----------|---------|-------|--------|
| `GetFeedUseCase` | Page of others' completed workouts (or one author's, FR-PV-007) as `FeedItem[]` + `nextCursor` | 12.1 | planned |
| `GetWorkoutDetailUseCase` | Build `WorkoutDetailView` for a viewer | 12.1 | planned |
| `ToggleLikeUseCase` | Set like state `{ liked: boolean }` idempotently; returns `{ liked, likeCount }` | 12.1 | planned |
| `ListLikersUseCase` | Who liked a workout, newest first | 12.1 | planned |
| `AddCommentUseCase` | Validate the body, create a comment on a completed workout | 12.1 | planned |
| `EditCommentUseCase` | Author edits the body; bumps `updatedAt` | 12.1 | planned |
| `DeleteCommentUseCase` | Author or workout owner deletes | 12.1 | planned |
| `GetActivityUseCase` | Page of `ActivityItem` for my workouts, flagged `isNew` | 12.1 | planned |
| `MarkActivitySeenUseCase` | `activity_seen_at = now` | 12.1 | planned |
| `HasUnseenActivityUseCase` | Boolean for the Inicio tab dot | 12.1 | planned |
| `SaveRoutineFromWorkoutUseCase` | Copy the routine behind another user's workout into one of my programs (FR-SO-009) | 12.1 | planned |
| `GenerateShareImageDataUseCase` | Owner-only `ShareImageData` for the client canvas | 12.2 | planned |

### Orchestration

1. **`GetFeedUseCase.execute({ viewerId, authorId?, cursor? })`**
   1. Decode `cursor` (if any).
   2. `FeedQueryRepository.listCompletedPage({ viewerId, authorId, cursor, limit: FeedPageSize + 1 })`. The extra row decides `nextCursor`.
   3. With the ≤ 20 ids, in parallel: `listCompletedSets(ids)`, `LikeRepository.countByWorkouts(ids)`, `CommentRepository.countByWorkouts(ids)`, `LikeRepository.listLikedWorkoutIds(viewerId, ids)`, `PrCountPort.countByWorkouts(ids)`.
   4. `summarizeWorkout` + `pickBestSet` per workout. Keep the first `FeedExercisePreview` exercises; `extraExerciseCount = total − 3`.
   5. Return `{ items, nextCursor }`. The number of queries per page is fixed (no N+1).
2. **`GetWorkoutDetailUseCase.execute({ workoutId, viewerId })`**
   1. `findWorkoutHeader`. Missing → `WorkoutNotVisibleError`. `in_progress`: owner → `WorkoutInProgressError`, anyone else → `WorkoutNotVisibleError`.
   2. In parallel: `listCompletedSets([id])`, `PrCountPort.listByWorkout(id)`, like count + liked-by-me, `CommentRepository.listByWorkout(id)`.
   3. Group sets by workout exercise, apply `deriveSetLabels`, attach `prTypes` by `entryId`.
   4. Comments: `canEdit = author === viewer`, `canDelete = author === viewer || owner === viewer`, `edited = updatedAt > createdAt`.
   5. If `canSaveRoutine`: `RoutineCopyPort.listTargetPrograms(viewerId)`.
3. **`ToggleLikeUseCase.execute({ workoutId, userId, liked })`**: the header must be completed (`WorkoutNotVisibleError`); owner → `SelfLikeError`; `liked ? upsert : delete`; return the new count.
4. **`ListLikersUseCase.execute({ workoutId, viewerId })`**: visibility check, then `listLikers` (newest first).
5. **`AddCommentUseCase.execute({ workoutId, userId, body })`**: visibility check (the owner may comment on their own completed workout, FR-SO-007); `validateCommentBody`; `create`; return `CommentView`.
6. **`EditCommentUseCase.execute({ commentId, userId, body, now? })`**: `findById` (`CommentNotFoundError`); author check (`CommentPermissionError`); validate; `update`.
7. **`DeleteCommentUseCase.execute({ commentId, userId })`**: `findById`; load the workout owner with `findWorkoutHeader`; allow author or owner; `delete`.
8. **`GetActivityUseCase.execute({ userId, cursor? })`**: `seenAt = findSeenAt(userId)`; `listForOwner(userId, cursor, FeedPageSize + 1)`; flag `isNew = createdAt > seenAt`; truncate comment previews.
9. **`MarkActivitySeenUseCase.execute({ userId, now? })`**: `markSeen(userId, now ?? new Date())`. The `/activity` page calls it **after** step 8, so the first render still highlights new items.
10. **`HasUnseenActivityUseCase.execute({ userId })`**: `ActivityRepository.hasUnseen(userId)` (one `EXISTS` query).
11. **`SaveRoutineFromWorkoutUseCase.execute({ workoutId, userId, targetProgramId })`**: header visible and completed; own workout → `RoutineNotCopyableError`; `routineDayId` null → `RoutineNotCopyableError`; then `RoutineCopyPort.copyRoutine(...)`. Phase 1 workouts point to template routine days ([ADR-018 §4](../../decisions/018-user-owned-programs.md)); copying them is allowed.
12. **`GenerateShareImageDataUseCase.execute({ workoutId, userId })`**: header completed (`WorkoutNotVisibleError`) and owned (`NotWorkoutOwnerError`); sets → `summarizeWorkout`; `PrCountPort.listByWorkout` → `prCount` (total) and the first `MaxPrs` in exercise position order; first `MaxExercises` exercises; owner's `weightUnit` and `timezone` from `findWorkoutHeader`.

> Decision: likes use an explicit target state (`POST` = like, `DELETE` = unlike) instead of a blind toggle. A double tap or a retried request can never invert the state (Hevy behaviour: the heart reflects the last tap).
>
> Decision: feed pagination is keyset `(completed_at DESC, id DESC)` rather than offset. A sibling finishing a workout while I scroll cannot duplicate or skip a card. `/activity` uses the same approach.

---

## Infrastructure

Per [ADR-007](../../decisions/007-repository-pattern.md) and [ADR-011](../../decisions/011-implements-not-extends.md): abstract classes in `domain/`, concrete classes `implements` them.

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/social/domain/feed-query.repository.ts
import type { SocialWorkoutRow, SocialSetRow, FeedCursor } from './social.types';

export interface FeedPageQuery {
  viewerId: string;
  authorId?: string;      // set → only this author (FR-PV-007); unset → everyone except viewerId
  cursor?: FeedCursor;
  limit: number;
}

export interface WorkoutHeaderRow extends SocialWorkoutRow {
  ownerWeightUnit: 'kg' | 'lbs';   // for share data only
  ownerTimezone: string;
}

export abstract class FeedQueryRepository {
  /** Completed workouts, newest first by (completedAt, id). Joins profiles.display_name only. */
  abstract listCompletedPage(query: FeedPageQuery): Promise<SocialWorkoutRow[]>;
  /** Completed, non-deleted sets for the given workouts, joined with workout_exercises + exercises. */
  abstract listCompletedSets(workoutIds: string[]): Promise<SocialSetRow[]>;
  /** Any status. Returns undefined if missing. */
  abstract findWorkoutHeader(workoutId: string): Promise<WorkoutHeaderRow | undefined>;
}

// src/lib/contexts/social/domain/like.repository.ts
export abstract class LikeRepository {
  /** Idempotent (ON CONFLICT DO NOTHING). The SQLite impl throws SelfLikeError on an own workout (mirrors RLS). */
  abstract upsert(workoutId: string, userId: string): Promise<void>;
  /** Idempotent; deletes only the caller's like. */
  abstract delete(workoutId: string, userId: string): Promise<void>;
  abstract countByWorkouts(workoutIds: string[]): Promise<Map<string, number>>;
  abstract listLikedWorkoutIds(userId: string, workoutIds: string[]): Promise<Set<string>>;
  abstract listLikers(workoutId: string): Promise<Liker[]>;
}

// src/lib/contexts/social/domain/comment.repository.ts
import type { WorkoutComment, NewWorkoutComment } from '@db/schema';

export interface CommentWithAuthor extends WorkoutComment {
  authorDisplayName: string;
}

export abstract class CommentRepository {
  abstract findById(id: string): Promise<WorkoutComment | undefined>;
  /** Oldest → newest (FR-SO-005). */
  abstract listByWorkout(workoutId: string): Promise<CommentWithAuthor[]>;
  abstract create(input: Pick<NewWorkoutComment, 'workoutId' | 'userId' | 'body'>): Promise<WorkoutComment>;
  /** Author only; throws CommentPermissionError otherwise. Sets updatedAt. */
  abstract update(id: string, body: string, currentUserId: string): Promise<WorkoutComment>;
  /** Author or workout owner; throws CommentPermissionError otherwise. */
  abstract delete(id: string, currentUserId: string): Promise<void>;
  abstract countByWorkouts(workoutIds: string[]): Promise<Map<string, number>>;
}

// src/lib/contexts/social/domain/activity.repository.ts
export interface ActivityCursor {
  createdAt: Date;
  key: string;
}

export abstract class ActivityRepository {
  /** Likes + comments by other users on ownerId's completed workouts, newest first. */
  abstract listForOwner(
    ownerId: string,
    cursor: ActivityCursor | undefined,
    limit: number,
  ): Promise<Omit<ActivityItem, 'isNew'>[]>;
  abstract findSeenAt(userId: string): Promise<Date>;
  abstract markSeen(userId: string, at: Date): Promise<void>;
  abstract hasUnseen(userId: string): Promise<boolean>;
}
```

### SQLite Implementation

`infrastructure/sqlite/sqlite-{feed-query,like,comment,activity}.repository.ts`, constructor `(private readonly db: Db)` from `@/lib/db/client`, Drizzle query builder, like `SqlitePublicWorkoutRepository`.

- Feed page: `WHERE status = 'completed' AND user_id <> :viewer` (or `= :author`) `AND (completed_at < :c OR (completed_at = :c AND id < :id)) ORDER BY completed_at DESC, id DESC LIMIT :n`, inner join `profiles` selecting `display_name` only.
- Sets: `workout_entries we JOIN workout_exercises wx ON wx.id = we.workout_exercise_id JOIN exercises e ON e.id = we.exercise_id WHERE we.workout_id IN (…) AND we.completed = 1 AND we.deleted_at IS NULL AND wx.deleted_at IS NULL ORDER BY we.workout_id, wx.position, we.set_number`.
- SQLite has no RLS, so the repositories enforce the same rules in code ([database-schema.md](../../database-schema.md#phase-2-migrations)): `upsert` rejects a like on the user's own workout, `update` checks the author, `delete` checks the author **or** `workouts.user_id`.
- `hasUnseen`: `EXISTS(workout_likes l JOIN workouts w ON w.id = l.workout_id WHERE w.user_id = :me AND l.user_id <> :me AND l.created_at > profiles.activity_seen_at)`, `OR` the same for `workout_comments`.
- Timestamps are `mode: 'timestamp'` (seconds). Two writes in the same second leave `edited = false`. That is acceptable.

### Supabase Implementation

`infrastructure/supabase/supabase-*.repository.ts`, constructor `(private readonly supabase: SupabaseClient)`.

- Feed page: `.from('workouts').select('id, user_id, name, notes, status, routine_day_id, started_at, completed_at, profiles!inner(display_name)').eq('status', 'completed').neq('user_id', viewerId)` (or `.eq('user_id', authorId)`), keyset with `.or('completed_at.lt.<c>,and(completed_at.eq.<c>,id.lt.<id>)')`, then `.order('completed_at', { ascending: false }).order('id', { ascending: false }).limit(n)`. Never select `readiness_score` or `is_deload`.
- Sets: one `.from('workout_entries').select('…, workout_exercises!inner(position, superset_group, notes, deleted_at), exercises!inner(name, exercise_type)').in('workout_id', ids).eq('completed', true).is('deleted_at', null)`. Aggregation happens in the domain, as in `SupabaseWorkoutRepository.getHistoryByUser`.
- Counts: `.from('workout_likes').select('workout_id').in('workout_id', ids)`, counted in JS (≤ 20 workouts × family size rows).
- Like `upsert`: `.upsert({ workout_id, user_id }, { onConflict: 'workout_id,user_id', ignoreDuplicates: true })`. RLS refuses a self-like (`workout_likes_insert_own`); the use case rejects it first.
- A comment delete denied by RLS returns **no error and 0 rows**. The repository uses `.delete().eq('id', id).select('id')` and throws `CommentPermissionError` when no row comes back.
- `markSeen`: `.from('profiles').update({ activity_seen_at }).eq('id', userId)` (profiles update is own-only).
- RLS does not check `workouts.status`. The "completed only" rule for likes and comments is enforced by the use cases, which are the only write path.

### Query performance

Indexes used (all from migrations 001, 004 and 010):

| Query | Index |
|---|---|
| Member workouts list (`authorId` set) | `idx_workouts_completed (user_id, completed_at DESC) WHERE status = 'completed'` — exact match |
| Family feed (`user_id <> viewer`) | `idx_workouts_completed` per user, or a scan of completed workouts. At family scale (< 10 users, < 10 k workouts) this stays in single-digit ms. If it ever grows, add `(completed_at DESC) WHERE status = 'completed'`; not needed in Phase 2 |
| Sets of a page | `idx_entries_workout (workout_id)`, `workout_exercises` PK, `exercises` PK |
| Like counts / liked-by-me | PK `(workout_id, user_id)` (prefix `workout_id`). `idx_workout_likes_workout` duplicates the PK prefix; harmless |
| Comment list / counts | `idx_workout_comments_workout (workout_id, created_at)` |
| Activity, unseen dot | `idx_workouts_status (user_id, status)` to find my workouts, then the like/comment indexes above |

The feed runs 6 queries per page (page, sets, likes, comments, liked-by-me, PR counts), whatever the page size. `HasUnseenActivityUseCase` runs on every authenticated page render (nav dot) and is a single `EXISTS`.

### Wiring (Per-Context Composition)

Per [ADR-010](../../decisions/010-per-context-composition.md). `src/lib/contexts/social/social.composition.ts` follows `public-view.composition.ts`:

```ts
// src/lib/contexts/social/social.composition.ts
import { db } from '@/lib/db/client';
import { getSupabaseClient } from '@/lib/supabase/client';
import { prCountPort } from '@/lib/contexts/progress/progress.composition';     // PrCountPort instance (story 10.1)
import { routineCopyPort } from '@/lib/contexts/routines/routines.composition'; // RoutineCopyPort instance (story 8.2)
// … Sqlite*/Supabase* repositories, use cases

const backend = resolveStorageBackend(); // same helper shape as the other compositions

const feedQueryRepo = backend === 'sqlite' ? new SqliteFeedQueryRepository(db) : new SupabaseFeedQueryRepository(getSupabaseClient());
const likeRepo = backend === 'sqlite' ? new SqliteLikeRepository(db) : new SupabaseLikeRepository(getSupabaseClient());
const commentRepo = backend === 'sqlite' ? new SqliteCommentRepository(db) : new SupabaseCommentRepository(getSupabaseClient());
const activityRepo = backend === 'sqlite' ? new SqliteActivityRepository(db) : new SupabaseActivityRepository(getSupabaseClient());

export const getFeedUseCase = new GetFeedUseCase(feedQueryRepo, likeRepo, commentRepo, prCountPort);
export const getWorkoutDetailUseCase = new GetWorkoutDetailUseCase(feedQueryRepo, likeRepo, commentRepo, prCountPort, routineCopyPort);
export const toggleLikeUseCase = new ToggleLikeUseCase(feedQueryRepo, likeRepo);
export const listLikersUseCase = new ListLikersUseCase(feedQueryRepo, likeRepo);
export const addCommentUseCase = new AddCommentUseCase(feedQueryRepo, commentRepo);
export const editCommentUseCase = new EditCommentUseCase(commentRepo);
export const deleteCommentUseCase = new DeleteCommentUseCase(feedQueryRepo, commentRepo);
export const getActivityUseCase = new GetActivityUseCase(activityRepo);
export const markActivitySeenUseCase = new MarkActivitySeenUseCase(activityRepo);
export const hasUnseenActivityUseCase = new HasUnseenActivityUseCase(activityRepo);
export const saveRoutineFromWorkoutUseCase = new SaveRoutineFromWorkoutUseCase(feedQueryRepo, routineCopyPort);
export const generateShareImageDataUseCase = new GenerateShareImageDataUseCase(feedQueryRepo, prCountPort);
```

### Migrations (story 12.1)

`supabase/migrations/010_social.sql` and `db/migrations/0010_social.sql` (from `drizzle-kit generate`), exactly as in [database-schema.md → 010](../../database-schema.md#phase-2-migrations). Regression: the Phase 1 fixture DB (`tests/fixtures/phase-1.db`) still renders history, progress and family pages with the same numbers ([Phase rules §6](../../../stories/phase-2/readme.md#6-phase-1-compatibility)).

---

## UI

Spec: [components.md → Social](../../components.md#social). React islands are `.tsx`, static parts `.astro`, filenames kebab-case, copy Spanish ([ADR-015](../../decisions/015-live-workout-react-island.md)). Islands never import repositories; they call the endpoints below.

### Components

| Component | File | Kind | Notes |
|---|---|---|---|
| `FeedList` | `src/components/social/feed-list.tsx` | island (`client:visible`) | Receives the first `FeedPage` from SSR; *Cargar más* fetches `GET /api/feed?cursor=`. Empty state: "Cuando tu familia entrene, lo verás aquí" |
| `FeedCard` | `src/components/social/feed-card.tsx` | used by `FeedList` | FR-SO-002 layout; the card links to `/workouts/{id}`; the heart is a `LikeButton` |
| `LikeButton` | `src/components/social/like-button.tsx` | island | Optimistic ❤️; hidden when `canLike = false`; tapping the count opens the likers sheet (`GET …/likes`) |
| `WorkoutDetail` | `src/components/social/workout-detail.astro` | static | Header stats, exercises with set labels and 🏆 badges, supersets grouped under a "Superserie" bar, notes |
| `CommentList` | `src/components/social/comment-list.tsx` | island | Oldest → newest, "(editado)", inline edit/delete per `canEdit`/`canDelete`, confirm on delete ("¿Eliminar comentario?") |
| `CommentForm` | `src/components/social/comment-form.tsx` | used by `CommentList` | Textarea `maxlength=500` (server is authoritative), counter "N/500", *Publicar* |
| `SaveRoutineButton` | `src/components/social/save-routine-button.tsx` | island | *Guardar rutina* → program picker (`targetPrograms` + "Nuevo programa: Copiadas") → `POST …/save-routine` |
| `ShareImageButton` | `src/components/social/share-image-button.tsx` | island | *Compartir*; draws the canvas from `ShareImageData` ([share-workout-image.flow.md](./flows/share-workout-image.flow.md)) |
| `ActivityList` | `src/components/social/activity-list.astro` | static | "Ana le dio ❤️ a Pierna A", "Luis comentó: …"; new items highlighted |
| formatting helpers | `src/components/social/social-format.ts` | module | `formatWeight(kg, unit)`, `formatDuration(s)`, `formatBestSet(set, type, unit)`, `formatRelative(date)` ("hace 2 h"); shared by cards, detail and canvas |

### Pages

| Route | File | Notes |
|---|---|---|
| Inicio feed section | `src/pages/dashboard.astro` | Below the next-workout card ([ADR-024 → Consequences](../../decisions/024-social-interactions.md)). SSR calls `getFeedUseCase` for page 1 |
| `/workouts/[id]` | `src/pages/workouts/[id].astro` | Shared read-only detail for any completed workout, also opened from History v2 ([FR-PR-018](../../../prd/features/progress.md#fr-pr-018)). The owner sees *Editar*, *Eliminar*, *Repetir* (workout-tracking endpoints, [FR-WT-039](../../../prd/features/workout-tracking.md#fr-wt-039), [FR-WT-018](../../../prd/features/workout-tracking.md#fr-wt-018)) and *Compartir* (SSR passes `ShareImageData`). Others see ❤️, comments and *Guardar rutina*. Own `in_progress` → redirect to `/workout/[id]` (live island) |
| Summary v2 *Compartir* | workout-tracking summary page | [FR-WT-036](../../../prd/features/workout-tracking.md#fr-wt-036) also renders `ShareImageButton`; its SSR calls `generateShareImageDataUseCase` |
| `/activity` | `src/pages/activity.astro` | SSR: `getActivityUseCase`, then `markActivitySeenUseCase` |
| Nav dot | app layout → navigation | The layout calls `hasUnseenActivityUseCase` and passes `hasUnseenActivity` to the Inicio tab ([components.md → Navigation v2](../../components.md#navigation-v2)) |

Weights are shown in the **viewer's** `weight_unit` (FR-SO-002, [ADR-006](../../decisions/006-kg-storage.md)).

### API endpoints

All require a session (401 otherwise) and follow the shape of `src/pages/api/workouts/[id]/complete.ts`.

| Method | Path | Use case | Notes |
|---|---|---|---|
| GET | `/api/feed?cursor=&author=` | `GetFeedUseCase` | `author` = member id (FR-PV-007). 200 `{ items, nextCursor }`; 400 bad cursor |
| GET | `/api/workouts/[id]/detail` | `GetWorkoutDetailUseCase` | JSON for client refresh; the page itself calls the use case in SSR. 404 not visible |
| GET | `/api/workouts/[id]/likes` | `ListLikersUseCase` | 200 `Liker[]` |
| POST | `/api/workouts/[id]/likes` | `ToggleLikeUseCase` (`liked: true`) | Idempotent. 200 `{ liked, likeCount }`; 403 own workout; 404 |
| DELETE | `/api/workouts/[id]/likes` | `ToggleLikeUseCase` (`liked: false`) | Idempotent. 200 `{ liked, likeCount }` |
| POST | `/api/workouts/[id]/comments` | `AddCommentUseCase` | Body `{ body }`. 201 `CommentView`; 400 length; 404 |
| PATCH | `/api/comments/[id]` | `EditCommentUseCase` | Body `{ body }`. 200 `CommentView`; 403 not author; 404 |
| DELETE | `/api/comments/[id]` | `DeleteCommentUseCase` | 204; 403 neither author nor workout owner; 404 |
| GET | `/api/activity?cursor=` | `GetActivityUseCase` | *Cargar más* on `/activity`. Does **not** mark activity seen |
| POST | `/api/workouts/[id]/save-routine` | `SaveRoutineFromWorkoutUseCase` | Body `{ targetProgramId: string \| null }`. 201 `{ programId, routineDayId }`; 400 not copyable |

No endpoint serves share data: `/workouts/[id]` passes `ShareImageData` to the island as a prop (ADR-015 §4 pattern). Feed and activity need the network; offline they show "Sin conexión" ([ADR-025 §1](../../decisions/025-offline-live-workout.md)).

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md): **no mocks**. Tests use real SQLite (`tests/social/test-db.ts` re-exports the shared harness, like `tests/public-view/test-db.ts`) and Object Mothers. Consumed ports use the providers' real SQLite adapters (progress `PrCountPort`, routines `RoutineCopyPort`).

| Area | File | What to test |
|---|---|---|
| Domain rules | `tests/social/social.rules.test.ts` | Table-driven `pickBestSet` (e1RM wins; reps > 12 falls back to heaviest; bodyweight → most reps; assisted negative weight; duration/distance; tie-breaks; warm-up only), `summarizeWorkout` (deleted sets excluded, negative weight not counted), `deriveSetLabels`, `validateCommentBody` (empty, whitespace, 500 vs 501 code points, emoji counted once), cursor round-trip |
| Feed query | `tests/social/sqlite-feed-query.repository.test.ts` | Excludes the viewer's own and `in_progress` workouts; `authorId` filter; order and keyset (insert a newer workout between pages → no duplicate, no skip); returned objects contain no private fields |
| Likes / comments | `tests/social/sqlite-like.repository.test.ts`, `sqlite-comment.repository.test.ts` | Like twice = 1 row; self-like rejected; unlike missing = no-op; edit by non-author rejected; delete by workout owner allowed; delete by a third user rejected |
| Use cases | `tests/social/*.use-case.test.ts` | Each row of the Use Cases table, including errors; `MarkActivitySeen` then `HasUnseen` = false; a like after `now` → true; my own comment on my own workout is not activity |
| Share data | `tests/social/generate-share-image-data.use-case.test.ts` | Non-owner → `NotWorkoutOwnerError`; ≤ 3 PRs, ≤ 6 exercises, `extraExerciseCount`; no body metrics in the output |
| RLS (Supabase) | `tests/supabase/rls-social.integration.test.ts` | As **non-owner**: can read likes and comments (read-all); cannot insert a like with another `user_id`; cannot delete someone else's like; cannot update someone else's comment; cannot delete the owner's comment on the owner's workout (0 rows); cannot update another profile's `activity_seen_at`. As **owner**: cannot like their own workout; can delete the non-owner's comment on their own workout. Same gating as `rls-workout.integration.test.ts` |

Mothers in `tests/social/social.mothers.ts`: `CompletedWorkoutMother.create(db, { userId, completedAt?, exercises? })` (inserts `workouts` + `workout_exercises` + `workout_entries`), `InProgressWorkoutMother`, `CommentMother.create(db, { workoutId, userId, body? })`, `LikeMother.create(db, { workoutId, userId })`, and `ProfileMother.create(db)` reusing the profile insert from `tests/public-view/sqlite-public-workout.repository.test.ts`.

```ts
// tests/social/get-feed.use-case.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, type TestDbHandle } from './test-db';
import { SqliteFeedQueryRepository } from '@/lib/contexts/social/infrastructure/sqlite/sqlite-feed-query.repository';
import { SqliteLikeRepository } from '@/lib/contexts/social/infrastructure/sqlite/sqlite-like.repository';
import { SqliteCommentRepository } from '@/lib/contexts/social/infrastructure/sqlite/sqlite-comment.repository';
import { SqlitePrCountAdapter } from '@/lib/contexts/progress/infrastructure/sqlite/sqlite-pr-count.adapter'; // name per progress readme
import { GetFeedUseCase } from '@/lib/contexts/social/application/get-feed.use-case';
import { ProfileMother, CompletedWorkoutMother, InProgressWorkoutMother } from './social.mothers';

describe('GetFeedUseCase', () => {
  let handle: TestDbHandle;
  let useCase: GetFeedUseCase;

  beforeEach(() => {
    handle = createTestDb();
    useCase = new GetFeedUseCase(
      new SqliteFeedQueryRepository(handle.db),
      new SqliteLikeRepository(handle.db),
      new SqliteCommentRepository(handle.db),
      new SqlitePrCountAdapter(handle.db),
    );
  });

  it('shows only completed workouts of other users, newest first', async () => {
    const me = await ProfileMother.create(handle.db);
    const sister = await ProfileMother.create(handle.db);
    await CompletedWorkoutMother.create(handle.db, { userId: me.id });
    const older = await CompletedWorkoutMother.create(handle.db, { userId: sister.id, completedAt: new Date('2026-09-01T10:00:00Z') });
    const newer = await CompletedWorkoutMother.create(handle.db, { userId: sister.id, completedAt: new Date('2026-09-02T10:00:00Z') });
    await InProgressWorkoutMother.create(handle.db, { userId: sister.id });

    const page = await useCase.execute({ viewerId: me.id });

    expect(page.items.map((i) => i.workoutId)).toEqual([newer.id, older.id]);
    expect(page.nextCursor).toBeNull();
  });
});
```

---

## Flows

- [view-feed.flow.md](./flows/view-feed.flow.md)
- [like-and-comment.flow.md](./flows/like-and-comment.flow.md)
- [share-workout-image.flow.md](./flows/share-workout-image.flow.md)
