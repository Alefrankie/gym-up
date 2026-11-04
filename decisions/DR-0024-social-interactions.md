---
id: DR-0024
title: "Social Interactions — Family Feed, Likes, Comments (No Follow Graph)"
status: accepted
tier: 2
date: 2026-10-01
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: human

scope: cross-team
reversibility: costly
risk_flags: [privacy, data]

depends_on: []
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code: []
  issues:
    - "docs/stories/phase-2/readme.md"
  prs: []

validation:
  criteria:
    - "A user can like another user's completed workout at most once"
    - "Feed cards never show photos, body metrics, readiness or nutrition"
  review_by: null
  evidence: []
  validated_on: null

tags: []
legacy_id: ADR-024
---
# DR-0024 · Social Interactions — Family Feed, Likes, Comments (No Follow Graph)

## Legacy status

Accepted

## Context

Hevy's home tab is a feed of workouts from people you follow, with likes and comments. Gym-up's visibility model is "every user is family, read-all" ([ADR-004](./DR-0004-rls-visibility.md)). Phase 1 public view is read-only member cards.

## Decision

1. **No follow graph.** The feed shows completed workouts of **all users except me**, newest first, paginated 20 per page. My own workouts appear in my profile/history.
2. **Likes:** `workout_likes(workout_id, user_id, created_at)`, PK `(workout_id, user_id)`. A user can like any completed workout of another user, at most once. Unlike = delete. A user cannot like their own workout (as in Hevy, the button is hidden on your own workouts).
3. **Comments:** `workout_comments(id, workout_id, user_id, body, created_at, updated_at)`. Body 1–500 characters, plain text (rendered escaped, no markdown, no links auto-embedded). Authors can edit or delete their comments. The **workout owner can delete any comment** on their workout (moderation).
4. **RLS:** read-all; insert/update/delete own. The extra owner-delete for comments uses `EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())`.
5. **Activity indicator:** `profiles.activity_seen_at`. The nav shows a dot when likes or comments on my workouts exist with `created_at > activity_seen_at`. Opening `/activity` updates it. There are no push or e-mail notifications in Phase 2.
6. **Privacy boundaries stay:** the feed card shows name, workout name, date, duration, volume, sets, PR count and the exercise list. It never shows photos, body metrics, readiness or nutrition ([ADR-005](./DR-0005-private-photos.md), [ADR-023](./DR-0023-body-metrics-privacy.md)).

## Rationale

- A family of a few users does not need a follow graph. The family *is* the graph.
- Likes and comments are the Hevy features that actually drive motivation between siblings.

## Trade-offs

- **Pro:** Two small tables. Same RLS pattern as everything else.
- **Con:** If the app ever opens to non-family users, a follow/group model is needed. That is tracked as PI-024 (groups), out of Phase 2.

## Consequences

- New context `social` ([context](../docs/architecture/contexts/social/readme.md), [PRD](../docs/prd/features/social.md)). `public-view` keeps member list and profile pages; the feed is in `social`.
- Navigation: the feed becomes the **Inicio** tab content below "next workout" (Hevy home) — see [components.md → Navigation v2](../docs/architecture/components.md#navigation-v2).

## Referenced by

- [social PRD](../docs/prd/features/social.md)
- [database-schema.md](../docs/architecture/database-schema.md)

## Log

- 2026-10-01 accepted as ADR-024 (legacy record)
- 2026-11-04 migrated to DDE from docs/architecture/decisions/024-social-interactions.md; status mapped to the code as of today: accepted. Tier computed from reversibility x scope (+ risk overrides). Deciders inferred from repo ownership.
- 2026-11-04 validation.criteria derived from the Decision text at migration; no evidence recorded yet.
- 2026-11-04 note: Not built on 2026-11-04 (no workout_likes / workout_comments tables).
- 2026-11-04 note: Possible conflict with PRODUCT.md ("a private group, never a feed"): open owner decision, see PRODUCT.md.
- 2026-11-04 note: Where it mentions Supabase/RLS, DR-0027 supersedes the implementation detail.
