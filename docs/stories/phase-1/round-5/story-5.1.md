---
story_id: "5.1"
round: "round-5"
parent_spec: "../../architecture/contexts/nutrition/readme.md"
size: "L"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["nutrition"]
  prd_requirements: ["FR-NA-003", "FR-NA-004", "FR-NA-005"]
  architecture_decisions: ["ADR-007"]
  flows: ["analyze-meal.flow.md"]
blocked_by: ["story-1.3"]
blocks: ["story-5.2"]
---

# Story 5.1 — AI Nutrition Analysis Endpoint

Parent: [../readme.md](../readme.md)

## Summary

Server-side endpoint that accepts a food photo, sends to AI provider, returns calorie/macro estimates.

## Happy Path

1. Create `POST /api/nutrition/analyze` server route.
2. Accept base64 image in request body.
3. Validate: format (jpg/png/webp), size ≤ 5MB.
4. Send to AI provider (Gemini Vision or GPT-4 Vision).
5. Parse AI response: total_calories, total_protein, total_carbs, total_fat, food_items[].
6. Return structured response.

## Acceptance Criteria

- AC-5.1-01: Endpoint accepts photo and returns estimates per [FR-NA-003](../../prd/features/nutrition.md).
- AC-5.1-02: Async processing with 30s timeout per [FR-NA-004](../../prd/features/nutrition.md).
- AC-5.1-03: Returns error on unrecognized food per [FR-NA-005](../../prd/features/nutrition.md).

## Tasks

- [ ] `T5.1-01` - Create server route structure
- [ ] `T5.1-02` - Integrate AI provider (Gemini or OpenAI)
- [ ] `T5.1-03` - Parse AI response into structured DTOs
- [ ] `T5.1-04` - Handle timeout and error cases
- [ ] `T5.1-05` - Add validation (format, size)
