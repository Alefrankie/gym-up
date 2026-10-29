---
story_id: "12.1"
round: "round-12"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/social/readme.md"
size: "L"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["social", "public-view"]
  prd_requirements: ["FR-SO-001", "FR-SO-002", "FR-SO-003", "FR-SO-004", "FR-SO-005", "FR-SO-006", "FR-SO-007", "FR-SO-009", "FR-PV-007", "FR-PV-008", "FR-PV-009"]
  architecture_decisions: ["ADR-024"]
  flows: ["view-feed.flow.md", "like-and-comment.flow.md"]
blocked_by: ["story-9.3", "story-10.1"]
blocks: ["story-12.5", "story-12.2"]
---

# Story 12.1 — Family feed, workout detail, likes, comments, activity

Parent: [../readme.md](../readme.md)

## Summary

Ships the `social` context ([readme](../../../architecture/contexts/social/readme.md), [ADR-024](../../../architecture/decisions/024-social-interactions.md)): migration 010 (`workout_likes`, `workout_comments`, `profiles.activity_seen_at`), the keyset-paginated family feed on **Inicio**, the shared read-only workout detail `/workouts/[id]` with likes, comments and *Guardar rutina*, the `/activity` inbox with the unseen dot on the Inicio tab, and the public-view additions (member workouts list, member card stats, extended exclusions). It consumes `PrCountPort` (story 10.1) and `RoutineCopyPort` (story 8.2). Closes Hevy row **H20** and the social half of **U3** (private data never leaking; the browser check lands in story 12.5); it contributes to **H14** (copy a family routine).

## Files in scope

**Modify**

- `db/schema.ts` — add `workoutLikes`, `workoutComments`, `WorkoutLike`, `WorkoutComment`, `NewWorkoutComment`; add `profiles.activitySeenAt`.
- `src/pages/dashboard.astro` — feed section below the next-workout card; `getFeedUseCase` page 1 in SSR.
- `src/pages/workouts/[id].astro` — created by story 9.3 as the owner detail (*Editar*, *Repetir*, *Eliminar*); this story opens it to every viewer, adds likes, comments and *Guardar rutina*, and delegates the body to `workout-detail.astro`.
- `src/pages/family/[user_id].astro` — *Entrenamientos* section (`FeedList` with `authorId`).
- `src/components/family-member-card.astro` — weekly streak and 30-day PR count.
- `src/lib/contexts/public-view/domain/member.ts` — `MemberStats` / `MemberCard` gain `weeklyStreak`, `prsLast30Days`.
- `src/lib/contexts/public-view/application/calculate-member-stats.use-case.ts` — new inputs (`now?`, weekly streak, `PrCountPort`).
- `src/lib/contexts/public-view/application/get-all-members.use-case.ts` — fills the two new card fields.
- `src/lib/contexts/public-view/infrastructure/{sqlite/sqlite-public-profile.repository.ts,supabase/supabase-public-profile.repository.ts}` — verify the column lists stay explicit (no new columns leak).
- `src/lib/contexts/public-view/public-view.composition.ts` — inject the new dependencies.
- `src/layouts/app-layout.astro` — resolve `hasUnseenActivity` once per authenticated render and pass it to the navigation.
- `src/components/navigation/tab-bar.astro` — dot on *Inicio* (created in story 9.4; prop `hasUnseenActivity`).
- `tests/public-view/calculate-member-stats.use-case.test.ts` — extend.
- `docs/architecture/contexts/social/readme.md`, `docs/architecture/contexts/public-view/readme.md`, `docs/architecture/components.md` — final task.

**Create**

- `supabase/migrations/010_social.sql` (DDL and RLS exactly as in [database-schema.md → 010](../../../architecture/database-schema.md#010--social-adr-024)); `db/migrations/00NN_social.sql` + `meta/*` from `drizzle-kit generate --name social` (`NN` is the next free Drizzle index).
- `src/lib/contexts/social/domain/`: `social.types.ts`, `social.constants.ts`, `social.rules.ts`, `social.errors.ts`, `feed-query.repository.ts`, `like.repository.ts`, `comment.repository.ts`, `activity.repository.ts`.
- `src/lib/contexts/social/application/`: `get-feed`, `get-workout-detail`, `toggle-like`, `list-likers`, `add-comment`, `edit-comment`, `delete-comment`, `get-activity`, `mark-activity-seen`, `has-unseen-activity`, `save-routine-from-workout` (each `*.use-case.ts`).
- `src/lib/contexts/social/infrastructure/sqlite/sqlite-{feed-query,like,comment,activity}.repository.ts`.
- `src/lib/contexts/social/infrastructure/supabase/supabase-{feed-query,like,comment,activity}.repository.ts`.
- `src/lib/contexts/social/social.composition.ts`.
- `src/lib/contexts/public-view/domain/public-view.constants.ts` (`VisibilityRules` extended, `MemberStatsRules`) — the file does not exist in code today; the Phase 1 `VisibilityRules` lives in the context doc only.
- `src/components/social/`: `feed-list.tsx`, `feed-card.tsx`, `like-button.tsx`, `workout-detail.astro`, `comment-list.tsx`, `comment-form.tsx`, `save-routine-button.tsx`, `activity-list.astro`, `social-format.ts`.
- `src/pages/activity.astro`.
- `src/pages/api/feed.ts`, `src/pages/api/activity.ts`, `src/pages/api/comments/[id].ts`, `src/pages/api/workouts/[id]/{detail,likes,comments,save-routine}.ts`.
- `tests/social/` (`test-db.ts`, `social.mothers.ts`, tests below), `tests/supabase/rls-social.integration.test.ts`, `tests/public-view/visibility.test.ts`.

**Not in scope (must not change)**: `src/lib/contexts/workout-tracking/**` write paths (the context never writes workouts); `src/lib/contexts/private-photos/**`; `supabase/migrations/001`–`009`. `GenerateShareImageDataUseCase` and `ShareImageButton` belong to [story 12.2](./story-12.2.md).

## Happy Path

1. Ana finishes *Pierna A* (story 9.3). Luis opens **Inicio**: below the next-workout card, `getFeedUseCase.execute({ viewerId })` returns page 1; `FeedList` renders `FeedCard`s (FR-SO-001, FR-SO-002) with weights in Luis's unit.
2. Luis taps the card → `/workouts/[id]`: header stats, every exercise with set labels `W/D/F/1…`, 🏆 badges, supersets under a "Superserie" bar, notes (FR-SO-003).
3. Luis taps ❤️: optimistic fill, `POST /api/workouts/[id]/likes`, count replaced by the server value (FR-SO-004). Tapping the count lists likers.
4. Luis writes a comment (1–500 code points) → `POST /api/workouts/[id]/comments`; the list appends it (FR-SO-005).
5. Ana sees the dot on **Inicio**; opens `/activity`: "Luis le dio ❤️ a Pierna A", "Luis comentó: …", both highlighted. The page calls `markActivitySeenUseCase` after rendering; the dot disappears on the next render (FR-SO-006).
6. Ana opens her own workout: she sees the likes and comments she received, can delete any comment and comment herself (FR-SO-007).
7. Luis taps *Guardar rutina* on Ana's workout → picks a program or "Nuevo programa: Copiadas" → `POST /api/workouts/[id]/save-routine` → the routine is copied to his programs (FR-SO-009).
8. Luis opens `/family/<Ana>`: *Entrenamientos* lists only Ana's completed workouts (FR-PV-007); her card shows "🔥 N semanas" and "🏆 N récords (30 días)" (FR-PV-008); no private data appears anywhere (FR-PV-009).

## Decisions

Everything below is a micro-decision not fixed by the context docs (rule: Hevy, then Gravl, then simplest).

| # | Decision |
|---|---|
| D1 | `/workouts/[id]` is created by story 9.3 for the owner; this story extends the same file to non-owners and extracts the shared body into `workout-detail.astro`. (Simplest: one route, one detail view.) |
| D2 | *Compartir* is not rendered in 12.1; story 12.2 adds the `ShareImageButton` slot to the same page. |
| D3 | `MemberStats.weeklyStreak` is `number \| null`. [Phase rule 7](../readme.md#7-forward-compatible-ui): this story is not blocked by 11.2, so while `calculateWeeklyStreakUseCase` does not exist the composition passes `null` and the card hides "🔥 N semanas". Story 11.2 wires the real value in `public-view.composition.ts`. |
| D4 | `RoutineCopyPort`: the **routines readme is authoritative** (the social readme defers to the provider). The use case calls `copyRoutine({ userId, sourceRoutineId: workout.routineDayId, targetProgramId })` and maps the result `routineId → routineDayId` so the endpoint keeps the social contract `{ programId, routineDayId }`. `listTargetPrograms` extra field `isActive` is dropped from `targetPrograms`. |
| D5 | `FeedList` is a React island with *Cargar más* via `GET /api/feed?cursor=` (social readme), not the static `?page=N` list of `components.md` (keyset pagination needs the cursor). |
| D6 | `PrCountPort.listByWorkout` can return `entryId = null` (`best_session_volume`). Such PRs appear in `WorkoutDetailView.prs` but attach to no set (`DetailSet.prTypes` uses non-null `entryId` only). |
| D7 | Dates cross the SSR → island JSON boundary as ISO strings; island props use a `Serialized<T>` helper type in `social-format.ts`. |
| D8 | The browser E2E for `/family/[user_id]` is deferred to story 12.5 (Playwright arrives with story 12.3, which runs in parallel); here the same rule is proven by a use-case/repo test (AC-12.1-14). |
| D9 | The layout is `src/layouts/app-layout.astro` (code), not `layout.astro` as `components.md → TabBar` says. |

## Acceptance Criteria

- AC-12.1-01 (FR-SO-001): `GetFeedUseCase` returns only `status = 'completed'` workouts of users other than the viewer, ordered `(completedAt DESC, id DESC)`, 20 per page (`SocialRules.FeedPageSize`); the 21st row yields `nextCursor`, otherwise `null`. A malformed cursor throws `InvalidCursorError`, and `GET /api/feed?cursor=x` answers 400. Inserting a newer workout between page 1 and page 2 produces no duplicate and no skipped card.
- AC-12.1-02 (FR-SO-002): `FeedItem` aggregates come from the domain, identical on both backends: `durationSeconds = completedAt − startedAt`; `setCount` counts completed, non-deleted sets of every type (warm-ups included); `volumeKg = Σ max(0, weightKg) × (reps ?? 0)` with no body weight; exercises ordered by `position`, first 3 kept, `extraExerciseCount = total − 3`; `bestSet` per `pickBestSet` (table tests in the Test Plan).
- AC-12.1-03 (FR-SO-001, FR-SO-002): `FeedCard` shows avatar initial and name, relative time, workout name, duration · volume (viewer's `weight_unit`) · sets, 🏆 count only when > 0, the 3 exercise lines (`formatBestSet` per exercise type), "+N ejercicios", ❤️ and 💬 counts; the whole card links to `/workouts/[id]`. With no items: "Cuando tu familia entrene, lo verás aquí". *Cargar más* appends the next page and disappears when `nextCursor = null`; if the fetch fails it shows "Sin conexión" and keeps the loaded cards ([ADR-025 §1](../../../architecture/decisions/025-offline-live-workout.md)).
- AC-12.1-04 (FR-PV-009, ADR-024 §6): no social read model (`SocialWorkoutRow`, `FeedItem`, `WorkoutDetailView`, `ActivityItem`) contains photos, body measurements or weight, `readinessScore`, `isDeload`, progression overrides, AI summaries, nutrition, e-mail or profile settings; a test asserts the exact key sets. The repositories list columns explicitly and never `select('*')` on `workouts` or `profiles`.
- AC-12.1-05 (FR-SO-003): `/workouts/[id]` renders header stats, each exercise with all sets, labels (`W`, `D`, `F`, ordinal for normal sets), PR badges from `PrCountPort.listByWorkout`, supersets grouped, notes. Another user's `in_progress` workout or an unknown id → 404 (`WorkoutNotVisibleError`); the owner opening their own `in_progress` workout is redirected to `/workout/[id]` (`WorkoutInProgressError`).
- AC-12.1-06 (FR-SO-004): `POST /api/workouts/[id]/likes` and `DELETE …/likes` are idempotent target-state writes returning `{ liked, likeCount }`; liking twice leaves one row, unliking a missing like is a no-op, a double tap ends in the last tapped state. `LikeButton` is optimistic and rolls back with the toast "No se pudo guardar el me gusta" on error. Tapping the count opens the likers list from `GET /api/workouts/[id]/likes`, newest first.
- AC-12.1-07 (FR-SO-004, ADR-024 §2): the owner of a workout cannot like it: the button is not rendered (`canLike = false`), `ToggleLikeUseCase` throws `SelfLikeError` (403), `SqliteLikeRepository.upsert` rejects it, and Supabase RLS `workout_likes_insert_own` rejects it (AC-12.1-17). A like on another user's `in_progress` workout → 404.
- AC-12.1-08 (FR-SO-005): `AddCommentUseCase` trims the body and accepts 1–500 **code points** (500 emoji accepted, 501 rejected, whitespace-only rejected) → 201 `CommentView`; invalid → 400 `CommentBodyInvalidError` and the form shows "El comentario debe tener entre 1 y 500 caracteres" keeping the text. Comments list oldest → newest and render escaped (`<script>` shows as text; no `set:html` / `dangerouslySetInnerHTML`). The form counter uses the same code-point rule.
- AC-12.1-09 (FR-SO-005): the author edits their comment (`PATCH /api/comments/[id]`, `updatedAt` bumps, "(editado)" appears when `updatedAt > createdAt`). Edit by a non-author → 403 `CommentPermissionError`. Delete is allowed for the author **and** for the workout owner (confirm "¿Eliminar comentario?" → 204); a third user gets 403; unknown id → 404. In Supabase a delete denied by RLS affects 0 rows and the repository throws `CommentPermissionError`.
- AC-12.1-10 (FR-SO-007): on the owner's own workout the detail shows the received likes and comments, the owner can comment on it and delete any comment, ❤️ is hidden, and the owner actions from story 9.3 (*Editar*, *Repetir*, *Eliminar*) keep working.
- AC-12.1-11 (FR-SO-006): `/activity` lists likes and comments by **other** users on **my** completed workouts, newest first, keyset-paginated (20, `GET /api/activity?cursor=` does not mark seen); each item has `isNew = createdAt > activity_seen_at` computed before `markActivitySeenUseCase`; comment previews are cut at `SocialRules.CommentPreviewLength` (80); my own comment on my own workout is not activity; deleting a workout removes its likes, comments and activity items (cascade).
- AC-12.1-12 (FR-SO-006): `HasUnseenActivityUseCase` returns `true` while any activity item has `createdAt > activity_seen_at`, `false` after `/activity` is opened, and `true` again after a later like. The `TabBar` shows the dot on *Inicio* on every authenticated page; the check is one `EXISTS` query per render.
- AC-12.1-13 (FR-SO-009): *Guardar rutina* renders only on another user's completed workout with `routineDayId` not null. `POST /api/workouts/[id]/save-routine` with `{ targetProgramId: null }` creates the program "Copiadas" and copies the routine; with a program id it copies into that program; 201 `{ programId, routineDayId }`. Own workout, or a workout with `routineDayId = null` → 400 `RoutineNotCopyableError`. A Phase 1 workout pointing at a template routine day is copyable. *Repetir* is never rendered on other users' workouts.
- AC-12.1-14 (FR-PV-007): `/family/[user_id]` shows *Entrenamientos* from `getFeedUseCase.execute({ viewerId, authorId })`: only that member's completed workouts, 20 per page, newest first; *Cargar más* calls `GET /api/feed?author=<id>&cursor=`; empty state "Todavía no hay entrenamientos"; on my own member page the ❤️ is hidden.
- AC-12.1-15 (FR-PV-008): the member card shows "🏆 N récords (30 días)" when `prsLast30Days > 0` (a PR completed 29 days ago counts, 31 days ago does not, with `now` injected) and "🔥 N semanas" when `weeklyStreak` is not null (D3). `days_per_week` is never returned or rendered.
- AC-12.1-16 (FR-PV-009): `VisibilityRules` gains `ShowBodyMetrics`, `ShowReadiness`, `ShowProgressionOverrides`, `ShowAiSummaries`, `ShowNutrition`, `ShowTrainingSettings` (all `false`); `tests/public-view/visibility.test.ts` asserts the keys of `MemberCard` and `MemberProfile` are exactly the allowed set; `PublicProfileRepository` never selects `email`, training or onboarding columns, deload columns, `active_program_id`, `timezone` or `activity_seen_at`.
- AC-12.1-17 (RLS, `STORAGE_BACKEND=supabase`): `tests/supabase/rls-social.integration.test.ts` proves as a **non-owner**: reads of likes and comments succeed (read-all); inserting a like with another `user_id` fails; deleting someone else's like affects 0 rows; updating someone else's comment affects 0 rows; deleting a comment that is neither theirs nor on their workout affects 0 rows; updating another profile's `activity_seen_at` affects 0 rows. As the **workout owner**: inserting a like on their own workout fails (no self-like); deleting a non-owner's comment on their own workout succeeds.
- AC-12.1-18 (migration, both backends): migration 010 applies on SQLite (Drizzle) and Supabase with the DDL and policies of the schema doc; `tests/social/phase-1-fixture.regression.test.ts` loads `tests/fixtures/phase-1.db`, runs the migrations and asserts that history, progress and family pages return the Phase 1 numbers and that the feed renders Phase 1 workouts with their exercise names.
- AC-12.1-19 (parity and cost): every use case returns the same result through the SQLite and the Supabase repositories (aggregation lives in the domain); one feed page runs a fixed number of queries (page, sets, likes, comments, liked-by-me, PR counts) for 1 or 20 workouts (no N+1).

## Tasks

- [ ] `T12.1-01` - Schema: add the Drizzle tables and `profiles.activitySeenAt` to `db/schema.ts`, run `drizzle-kit generate --name social`, write `supabase/migrations/010_social.sql` (tables, index, RLS incl. self-like block and owner-delete).
- [ ] `T12.1-02` - Phase 1 fixture regression test for migration 010 (`tests/social/phase-1-fixture.regression.test.ts`, loads `tests/fixtures/phase-1.db` from story 7.1).
- [ ] `T12.1-03` - Domain: `social.types.ts`, `social.constants.ts` (`SocialRules`, `ShareImageRules`, `BestSetRules`, `ActivityKinds`), `social.errors.ts`, `social.rules.ts` (`summarizeWorkout`, `pickBestSet`, `deriveSetLabels`, `validateCommentBody`, `encodeFeedCursor` / `decodeFeedCursor`) with table-driven tests.
- [ ] `T12.1-04` - Abstract ports `FeedQueryRepository`, `LikeRepository`, `CommentRepository`, `ActivityRepository`.
- [ ] `T12.1-05` - SQLite repositories (explicit column lists, keyset, code-enforced self-like and comment permissions, `hasUnseen` `EXISTS`) + repository tests (`test-db.ts`, `social.mothers.ts`).
- [ ] `T12.1-06` - Supabase repositories (`profiles!inner(display_name)`, `.or()` keyset, `ignoreDuplicates` upsert, 0-row delete → `CommentPermissionError`, `markSeen` on `profiles`).
- [ ] `T12.1-07` - Use cases `GetFeedUseCase`, `GetWorkoutDetailUseCase`, `ToggleLikeUseCase`, `ListLikersUseCase` + use-case tests.
- [ ] `T12.1-08` - Use cases `AddCommentUseCase`, `EditCommentUseCase`, `DeleteCommentUseCase`, `GetActivityUseCase`, `MarkActivitySeenUseCase`, `HasUnseenActivityUseCase`, `SaveRoutineFromWorkoutUseCase` (D4 mapping) + tests.
- [ ] `T12.1-09` - `social.composition.ts` (backend switch, `prCountPort` from progress, `routineCopyPort` from routines); composition smoke test on `sqlite`.
- [ ] `T12.1-10` - API endpoints (feed, activity, detail, likes GET/POST/DELETE, comments POST, `comments/[id]` PATCH/DELETE, save-routine) with 401/403/404/400 mapping.
- [ ] `T12.1-11` - UI: `social-format.ts`, `feed-card.tsx`, `feed-list.tsx`, `like-button.tsx` (optimistic + rollback + likers sheet).
- [ ] `T12.1-12` - UI: `workout-detail.astro`, `comment-list.tsx`, `comment-form.tsx`, `save-routine-button.tsx`; open `/workouts/[id]` to non-owners (D1); owner view keeps the 9.3 actions.
- [ ] `T12.1-13` - `/activity` page + `activity-list.astro`; `app-layout.astro` computes `hasUnseenActivity`; `tab-bar.astro` renders the dot.
- [ ] `T12.1-14` - Dashboard feed section (SSR page 1, viewer's unit) below the next-workout card.
- [ ] `T12.1-15` - Public view: `public-view.constants.ts`, `member.ts` additions, `CalculateMemberStatsUseCase` (D3), `GetAllMembersUseCase`, composition, `family-member-card.astro`, *Entrenamientos* on `/family/[user_id]`; `visibility.test.ts`.
- [ ] `T12.1-16` - `tests/supabase/rls-social.integration.test.ts` (non-owner and owner cases, same `RUN_SUPABASE_INTEGRATION` gate as `rls-workout.integration.test.ts`).
- [ ] `T12.1-17` - N+1 guard test and backend-parity check (same fixtures through both repositories when Supabase credentials exist).
- [ ] `T12.1-18` - Update docs: mark the social and public-view Use Cases rows `implemented`, fix doc/code drift found (D5, D9, `RoutineCopyPort` signature, `components.md → Social`), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/social/social.rules.test.ts` | unit (table) | `pickBestSet` (e1RM wins; reps > 12 falls back to heaviest; bodyweight → most reps; assisted negative weight; duration; distance; tie-breaks; warm-up only), `summarizeWorkout` (deleted sets excluded, negative weight not counted, warm-ups counted), `deriveSetLabels`, `validateCommentBody` (empty, whitespace, 500 / 501 code points, emoji once), cursor round-trip and invalid cursor (01, 02, 08) |
| `tests/social/sqlite-feed-query.repository.test.ts` | repo | Excludes own and `in_progress`; `authorId` filter; order and keyset with an insert between pages; key sets contain no private fields (01, 04, 14) |
| `tests/social/sqlite-like.repository.test.ts`, `sqlite-comment.repository.test.ts` | repo | Like twice = 1 row; self-like rejected; unlike missing = no-op; non-author edit rejected; owner delete allowed; third-user delete rejected (06, 07, 09) |
| `tests/social/get-feed.use-case.test.ts` | use-case | Newest first, others only, `nextCursor`, aggregates, PR counts from the real `PrCountPort` adapter, like/comment counts, `likedByMe` (01, 02, 19) |
| `tests/social/get-workout-detail.use-case.test.ts` | use-case | Labels, PR badges, `canEdit` / `canDelete`, `canSaveRoutine`, `targetPrograms`, 404 vs redirect error classes (05, 10, 13) |
| `tests/social/toggle-like.use-case.test.ts`, `list-likers.use-case.test.ts` | use-case | Idempotency, `SelfLikeError`, not-visible, newest-first likers (06, 07) |
| `tests/social/comment.use-cases.test.ts` | use-case | Add / edit / delete rules, "(editado)" flag, owner moderation, errors (08, 09, 10) |
| `tests/social/activity.use-cases.test.ts` | use-case | `isNew`, `MarkActivitySeen` then `HasUnseen = false`, later like → `true`, own comment on own workout is not activity, preview length, cascade on workout delete (11, 12) |
| `tests/social/save-routine-from-workout.use-case.test.ts` | use-case | `null` target → "Copiadas", program target, own / no-routine → `RoutineNotCopyableError`, Phase 1 template routine day (13) |
| `tests/social/phase-1-fixture.regression.test.ts` | integration | Phase 1 numbers unchanged after migration 010 (18) |
| `tests/social/query-count.test.ts` | integration | Fixed query count for 1 vs 20 workouts, via the Drizzle logger of the test db (19) |
| `tests/public-view/calculate-member-stats.use-case.test.ts` | use-case | PR on day 29 counts, day 31 does not (`now` injected); `weeklyStreak` `null` until wired (15) |
| `tests/public-view/visibility.test.ts` | unit | Exact key sets of `MemberCard` / `MemberProfile`; explicit profile columns (16) |
| `tests/public-view/family-member-feed.test.ts` | use-case | Member page list = that member's completed workouts only (14) |
| `tests/supabase/rls-social.integration.test.ts` | integration-RLS | Non-owner and owner cases listed in AC-12.1-17 |

## Out of Scope

- Share image (`GenerateShareImageDataUseCase`, `ShareImageButton`) → [story-12.2](./story-12.2.md).
- Offline behaviour of the feed beyond the "Sin conexión" message; service worker caching → [story-12.3](./story-12.3.md).
- Browser E2E of feed, likes, comments and the family page → [story-12.5](./story-12.5.md) (H20, U3).
- The real weekly streak value → story 11.2; the real PR badges engine → story 10.1 (consumed only).
- Push or e-mail notifications, follow graph, groups (PI-024), markdown or link embeds in comments.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
