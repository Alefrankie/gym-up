# Analyze Meal Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Happy Path

### Step 1 - Photo Capture

User opens `/nutrition` or taps "Analyze meal". Camera/file picker opens. User takes photo of food or selects from gallery.

### Step 2 - Client-Side Processing

Client validates file format (jpg/png/webp) and size (≤ 5MB). Compresses image via canvas re-encode (max 1024px, JPEG 0.85).

### Step 3 - AI Analysis Request

Client sends compressed image (base64) to `POST /api/nutrition/analyze`. Server routes to AI provider (Gemini Vision or GPT-4 Vision). AI identifies food items, estimates calories and macros.

### Step 4 - Loading State

UI shows loading spinner with "Analyzing your meal..." text. Timeout at 30 seconds.

### Step 5 - Results Display

AI returns: `total_calories`, `total_protein`, `total_carbs`, `total_fat`, `food_items[]`. UI renders:
- Total calories prominently.
- Macro breakdown (protein/carbs/fat) with bar or ring.
- List of identified food items with per-item estimates.

### Step 6 - User Edits (Optional)

User can adjust any estimate before saving. Tap on food item to edit calories/macros. `user_edited` flag set if changes made.

### Step 7 - Save Entry

User taps "Save". Client uploads photo to storage: `{userId}/nutrition/{timestamp}.jpg`. Creates `nutrition_entries` DB record.

### Step 8 - Daily Summary Update

Dashboard's daily calorie bar updates. Shows consumed vs goal.

---

## Failure: Food Not Recognized

Step 3 returns empty food_items or low confidence. Show: "Food not recognized. Try a clearer photo or better lighting." Do not save.

## Failure: AI Timeout

Step 3 times out after 30 seconds. Show: "Analysis took too long. Try again."

## Failure: File Too Large

Step 2 fails if file > 5MB. Show: "Photo too large. Max 5MB."

## Failure: Invalid Format

Step 2 fails if format not jpg/png/webp. Show: "Unsupported format. Use jpg, png, or webp."
