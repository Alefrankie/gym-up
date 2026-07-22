---
story_id: "5.2"
round: "round-5"
parent_spec: "../../architecture/contexts/nutrition/readme.md"
size: "M"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["nutrition"]
  prd_requirements: ["FR-NA-001", "FR-NA-002", "FR-NA-006", "FR-NA-007"]
  architecture_decisions: []
  flows: ["analyze-meal.flow.md"]
blocked_by: ["story-5.1"]
blocks: ["story-5.3"]
---

# Story 5.2 — Meal Photo Capture + Analysis UI

Parent: [../readme.md](../readme.md)

## Summary

UI for capturing food photos and displaying AI analysis results.

## Happy Path

1. User opens `/nutrition` or taps "Analyze meal".
2. Camera/file picker opens.
3. User takes/selects photo.
4. Client compresses and sends to `/api/nutrition/analyze`.
5. Loading state shown.
6. Results displayed: calories, macros, food items.
7. User can edit estimates before saving.

## Acceptance Criteria

- AC-5.2-01: Photo capture works per [FR-NA-001](../../prd/features/nutrition.md).
- AC-5.2-02: Compression before send per [FR-NA-002](../../prd/features/nutrition.md).
- AC-5.2-03: Results display per [FR-NA-006](../../prd/features/nutrition.md).
- AC-5.2-04: Edit/adjust works per [FR-NA-007](../../prd/features/nutrition.md).

## Tasks

- [ ] `T5.2-01` - Create MealPhotoCapture component
- [ ] `T5.2-02` - Add compression logic
- [ ] `T5.2-03` - Create NutritionResult component
- [ ] `T5.2-04` - Add edit/adjust functionality
- [ ] `T5.2-05` - Create nutrition page
