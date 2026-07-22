# Feature — Nutrition Analysis

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../README.md)

## Architecture Links

- Context: [nutrition context](../../architecture/contexts/nutrition/readme.md)
- Decisions: [ADR-007](../../architecture/decisions/007-ai-nutrition-analysis.md)

Photo-based nutrition analysis. User takes photo of food, AI estimates calories and macros.

---

## Functional Requirements

### Photo Capture

#### FR-NA-001

User can take a photo of food or select from gallery. Accept image formats: jpg, png, webp.

#### FR-NA-002

Photo is compressed client-side before sending to AI. Max 5MB.

### AI Analysis

#### FR-NA-003

Photo is sent to AI endpoint for food recognition and calorie estimation. Returns: estimated calories, protein (g), carbs (g), fat (g), food items identified.

#### FR-NA-004

AI analysis is async. User sees loading state while processing. Timeout at 30 seconds.

#### FR-NA-005

If AI cannot identify food, returns error with guidance: "Try a clearer photo" or "Food not recognized".

### Results Display

#### FR-NA-006

Results shown after analysis: total calories, protein, carbs, fat breakdown. List of identified food items with per-item estimates.

#### FR-NA-007

User can edit/adjust the AI estimates before saving. Manual override for each macro.

### History

#### FR-NA-008

All analyzed meals saved to history with photo thumbnail, date, totals. Chronological list.

#### FR-NA-009

Daily calorie summary: sum of all meals for current day. Progress toward daily goal (if set).

### Daily Goals

#### FR-NA-010

User can set daily calorie goal in settings. Optional.

#### FR-NA-011

Dashboard shows today's calorie intake vs goal. Progress bar or ring.

---

## Data

| Table | Access |
|-------|--------|
| `nutrition_entries` | CRUD own |
| `nutrition_goals` | Read/write own |

## AI Provider

TBD — options: Google Gemini Vision, OpenAI GPT-4 Vision, Claude Vision. See [ADR-007](../../architecture/decisions/007-ai-nutrition-analysis.md).
