# Share Workout Image Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-SO-008](../../../../prd/features/social.md#fr-so-008)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [12.2](../../../../stories/phase-2/round-12/story-12.2.md) |
| Decisions | [ADR-024](../../../decisions/024-social-interactions.md), [ADR-020](../../../decisions/020-personal-records.md), [ADR-023](../../../decisions/023-body-metrics-privacy.md) |

The server builds the numbers; the client draws the PNG. No image is generated or stored on the server.

## Happy Path

### Step 1 - Owner opens a completed workout

*Compartir* is rendered only for the owner of a completed workout, in two places: the workout detail `/workouts/{id}` and the summary v2 ([FR-WT-036](../../../../prd/features/workout-tracking.md#fr-wt-036)). Both pages call `generateShareImageDataUseCase.execute({ workoutId, userId })` in SSR and pass the resulting `ShareImageData` as a prop to the `ShareImageButton` island.

### Step 2 - Build the data (server)

`GenerateShareImageDataUseCase`:

1. `FeedQueryRepository.findWorkoutHeader(workoutId)` → must be `completed` and owned by `userId`.
2. `listCompletedSets([workoutId])` → `summarizeWorkout` (duration, volume, sets, exercises with `pickBestSet`).
3. `PrCountPort.listByWorkout(workoutId)` → `prCount` = total, `prs` = first `ShareImageRules.MaxPrs` (3) in exercise position order.
4. First `ShareImageRules.MaxExercises` (6) exercises + `extraExerciseCount`.
5. Owner's `weightUnit` and `timezone`.

The payload contains no display name, body metrics, photos, readiness or nutrition.

### Step 3 - User taps *Compartir*

The button shows "Generando…" and is disabled. The island waits for `document.fonts.ready` and decodes the logo (`/favicon.svg`, same origin, so the canvas is not tainted).

### Step 4 - Draw the canvas (1080 × 1350, light theme)

Off-DOM `<canvas width=1080 height=1350>`. Fixed light palette regardless of the app theme: background `#FFFFFF`, text `#111827`, secondary `#6B7280`, dividers `#E5E7EB`. Font: the app font (`Inter`, fallback `sans-serif`). Side margins 72 px, content width 936 px. Numbers use `Intl.NumberFormat('es')` and the owner's unit; strings come from `social-format.ts`.

| # | Block | Box (x, y, w, h) px | Content |
|---|---|---|---|
| 1 | Brand + date | 72, 72, 936, 64 | Logo 64 × 64 at (72, 72). "Gym Up" 40 px bold at x = 152, vertically centered. Date right-aligned at x = 1008, 30 px regular, secondary: `Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone })` → "1 de octubre de 2026" |
| 2 | Title | 72, 184, 936, 144 | Workout name, 64 px extra-bold, line height 72, word-wrapped to max 2 lines, "…" at the end of line 2 |
| 3 | Stats | 72, 368, 936, 160 | 2 px dividers at y = 368 and y = 528. Three 312 px columns at x = 72, 384, 696. Value 56 px extra-bold (baseline y = 448): "1 h 12 min" (or "48 min"), "8.240 kg", "24". Label 28 px secondary (baseline y = 496): "Duración", "Volumen", "Series" |
| 4 | PRs (only if `prCount > 0`) | 72, 576, 936, 200 | Heading "🏆 Récords" (or "🏆 Récords (N)" when `prCount > 3`) 36 px bold in a 56 px row. Then up to 3 lines of 48 px, 30 px regular: "Bench Press · Mejor 1RM · 95 kg" (record label from progress, value formatted for its record type) |
| 5 | Exercises | 72, y5, 936, ≤ 448 | `y5 = 808` when block 4 is drawn, else `576`. Heading "Ejercicios" 36 px bold in a 56 px row. Up to 6 rows of 58 px: left "3 × Bench Press" 34 px semibold, truncated with "…" at 600 px; right-aligned at x = 1008 the best set "80 kg × 8" 34 px regular secondary (`formatBestSet` per exercise type: "12 reps", "−20 kg × 8", "1:30", "5 km · 25:00"). 1 px divider between rows. Then "+N ejercicios" 30 px secondary in a 44 px row if `extraExerciseCount > 0` |

Worst case (3 PRs, 6 exercises, "+N") ends at y = 1256, inside the 72 px bottom margin (≤ 1278).

### Step 5 - Export the PNG

`canvas.toBlob(cb, 'image/png')` → `new File([blob], 'gymup-{date}.png', { type: 'image/png' })`, where `{date}` is `yyyy-mm-dd` in the owner's timezone (`Intl.DateTimeFormat('en-CA', { timeZone })`).

### Step 6 - Share or download

- If `navigator.canShare?.({ files: [file] })` is true: `navigator.share({ files: [file], title: workoutName })` (mobile share sheet: WhatsApp, Instagram, …).
- Otherwise: download through a temporary `<a download="gymup-{date}.png">` with `URL.createObjectURL(blob)`, then `revokeObjectURL`.

The button returns to *Compartir*.

---

## Edge Case: No PRs

Block 4 is skipped and block 5 starts at y = 576.

## Edge Case: More Than 6 Exercises

Only the first 6 by position are drawn, followed by "+N ejercicios".

## Edge Case: Long Names

Workout names wrap to 2 lines, then "…". Exercise names are truncated at 600 px so the best set column never overlaps.

## Edge Case: Bodyweight-Only Workout

Volume counts only added load ([social readme → Domain rules](../readme.md#domain-rules-socialrulests-pure-functions)), so it can be "0 kg". It is still drawn; body weight is never used (ADR-023).

## Edge Case: User Cancels the Share Sheet

`navigator.share` rejects with `AbortError`. Nothing happens; no toast, no download.

## Failure: Share API Error

Any other rejection (e.g. `NotAllowedError`) falls back to the download in Step 6 and shows "No se pudo compartir; la imagen se descargó".

## Failure: Not the Owner or Not Completed

The button is not rendered. The use case throws `NotWorkoutOwnerError` (403) or `WorkoutNotVisibleError` (404) if called for another user's or an `in_progress` workout.

## Failure: Logo or Font Not Loaded

If the logo fails to decode, block 1 draws the text "Gym Up" only. If the font is not ready after 2 s, drawing continues with the fallback `sans-serif`.
