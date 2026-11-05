---
id: DR-0028
title: "Authenticated global feed and member profiles without groups"
status: accepted
tier: 2
date: 2026-11-05
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: "@alefrank"
scope: cross-team
reversibility: costly
risk_flags: [privacy, security, data]
depends_on: [DR-0027]
supersedes: []
superseded_by: null
conflicts_with: [DR-0024]
links:
  code: [apps/api/src/nest/community/, apps/api/src/lib/contexts/community/, apps/api/db/migrations/0024_community.sql, apps/app/src/routes/community/]
  issues: []
  prs: []
validation:
  criteria:
    - "Authenticated users can read completed workouts across all members, including historical workouts, without shared groups"
    - "Unauthenticated requests cannot read feed, profiles, likes or shared images"
    - "Private photos, body metrics, nutrition, set notes and body-weight snapshots never appear in social responses"
    - "Like and unlike are idempotent; comments are absent"
    - "Workout completion and offline synchronization work even when image storage is unavailable"
  review_by: null
  evidence: []
  validated_on: null
tags: [social, privacy]
---
# DR-0028 · Authenticated global feed and member profiles without groups

## Status and authorization

Proposed technical design only. On 2026-11-05 the owner requested planning, not implementation, and confirmed: all signed-in members can see each other, automatic publication on completion/synchronization, optional explicitly shared photos, training-only weekly results, recent sessions with likes but no comments, and visibility of historical completed workouts. This record does not authorize production data changes or claim human approval of the technical mechanism below.

## Context

PRODUCT.md currently excludes feeds and public profiles. DR-0024 describes a feed with comments and no photos. The current GroupsController checks shared membership before serving member details. DR-0005 and DR-0023 protect private photos and body measurements. The new scope needs explicit, narrow read models rather than loosening existing owner-only endpoints.

## Proposed decision

- Replace groups in navigation with an authenticated Community feed; preserve the workout home screen. Remove group creation/joining/membership as a product feature, without deleting workout records.
- Query completed workouts directly for the feed and profile history. Include the entire completed history, with stable descending workout-date/id cursor pagination, 20 sessions per page. No copied posts or per-workout publication backfill. In-progress sessions are never visible.
- Keep the main feed focused on other members; the owner's history remains in their profile/history. No follow graph, comments, notifications or ranking algorithm.
- Add authenticated member projections for the active program, active supplement names, completed sessions and weekly training totals. Never reuse private response DTOs wholesale. Exclude free-text workout/set notes, body-weight snapshots, nutrition, readiness and private media.
- Add workout_likes with composite key (workout_id, user_id), authenticated idempotent PUT/DELETE, no self-likes. Return count and viewerHasLiked, not a voter directory.
- Add a separate shared-workout-photo resource, at most one photo per completed workout for this release. Only the owner uploads/removes; all signed-in members may read. Use a separate R2 key namespace and authenticated media delivery; never expose a public R2 URL or convert progress_photos. Photo failure must not block workout completion. Validate content and size and strip location/EXIF metadata.
- Weekly results use stored workout calendar dates, Monday through Sunday: session count, completed-set count and external-load volume (completed reps × external kg). Exclude body weight from public aggregates. Missing data remains unavailable rather than invented. No AI summary or inferred PR counts in this release.
- Retire group API operations and old UI links explicitly; old member URLs redirect to the new profile route. Stage release so older clients cannot continue mutating groups unnoticed. Retain obsolete group tables initially; destructive cleanup requires a separately reviewed migration after usage verification.

## Alternatives and rationale

- Copied social posts would need historical backfill and synchronization for every workout edit; direct projections keep one source of truth.
- Reusing private photo rows or private workout DTOs creates accidental disclosure risks. Separate projections and media resources preserve existing privacy boundaries.
- Physically dropping groups immediately adds unnecessary data-loss risk. Removing the feature and its active dependencies is sufficient for the first rollout.

## Consequences and policy reconciliation

This is at least T2 because privacy/security are involved; reversibility is costly and scope crosses app, API, contracts and storage. Before implementation, a human must review the proposal and reconcile PRODUCT.md and DR-0024 by a new accepted record or append-only Log entries. Do not rewrite accepted decision bodies. DR-0005's owner-only progress-photo policy and DR-0023 remain intact; shared workout photos are a distinct, deliberately published resource. Historical workout visibility requires an explicit release notice to existing users; private historical photos are excluded.

## Evidence and remaining validation

Inspected: apps/api/src/nest/groups/groups.controller.ts; apps/api/src/lib/contexts/public-view/; apps/api/src/nest/photos/photos.controller.ts; apps/api/db/schema.ts; packages/contracts/src/{workouts,supplements}.ts; apps/app/src/lib/components/AppNav.svelte. The owner-facing plan is the Traycer artifact “Feed global y perfiles · plan”, under this task's artifacts/feed-plan/index.html. No functional changes, migration, runtime tests or deployment have been performed.

## Log

- 2026-11-05 proposed after owner-approved planning scope; implementation remains unauthorized.
- 2026-11-05 accepted by @alefrank ("puedes comenzar" on the plan); implementation started on branch feat/community-feed. Not deployed; release notice ships as the in-app Community banner.
