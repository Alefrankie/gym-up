---
story_id: "5.3"
round: "round-5"
parent_spec: "../../architecture/contexts/nutrition/readme.md"
size: "M"
status: "completed"
started: "2026-08-14"
completed: "2026-08-15"
owner: "Julian"
implements:
  architecture_features: ["nutrition"]
  prd_requirements: ["FR-NA-008", "FR-NA-009", "FR-NA-010", "FR-NA-011"]
  architecture_decisions: []
  flows: ["analyze-meal.flow.md"]
blocked_by: ["story-5.2"]
blocks: []
---

# Story 5.3 — Nutrition History + Daily Summary

Parent: [../readme.md](../readme.md)

## Summary

Save analyzed meals, show history, daily calorie summary vs goal. Photo blobs are saved to the local filesystem via the same `StorageService` interface used by [story-4.2](../round-4/story-4.2.md); thumbnails are served through an authenticated route.

## Happy Path

1. After analysis, user taps "Save".
2. Photo persisted to local filesystem + `nutrition_entries` DB record created.
3. History page shows past meals with thumbnails.
4. Dashboard shows daily calorie bar (consumed vs goal).
5. User can set daily calorie goal in settings.

## Acceptance Criteria

- AC-5.3-01: History saved per [FR-NA-008](../../prd/features/nutrition.md).
- AC-5.3-02: Daily summary per [FR-NA-009](../../prd/features/nutrition.md).
- AC-5.3-03: Calorie goal settable per [FR-NA-010](../../prd/features/nutrition.md).
- AC-5.3-04: Dashboard progress bar per [FR-NA-011](../../prd/features/nutrition.md).

## Tasks

- [x] `T5.3-01` - Save nutrition entry (local photo + DB record)
- [x] `T5.3-02` - Create `src/components/nutrition-history.astro`
- [x] `T5.3-03` - Create `src/components/daily-calorie-bar.astro`
- [x] `T5.3-04` - Add calorie goal to settings
- [x] `T5.3-05` - Add daily summary to dashboard
