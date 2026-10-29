---
story_id: "11.3"
round: "round-11"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/private-photos/readme.md"
size: "S"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["private-photos", "body-metrics"]
  prd_requirements: ["FR-PP-008", "FR-PP-009", "FR-PP-010"]
  architecture_decisions: ["ADR-005", "ADR-023"]
  flows: ["compare-photos.flow.md"]
blocked_by: ["story-11.1"]
blocks: ["story-12.5"]
---

# Story 11.3 — Progress Photo Comparison

Parent: [../readme.md](../readme.md)

## Summary

Adds `/photos/compare`: two of the user's own progress photos side by side or under a draggable slider, with "N días entre fotos" and, when a body measurement exists within ±3 days of each photo, the body weight and its Δ. The gallery gains multi-select (long-press) to open the comparison directly. No new table, no migration and no new RLS policy: `progress_photos` and `body_measurements` are already owner-only. Closes gym-up unique row **U1** (comparison part) of the [exit criteria](../readme.md#exit-criteria--hevy--gravl-parity) (PI-005).

Context: [private-photos readme → Phase 2](../../../architecture/contexts/private-photos/readme.md#phase-2) · Flow: [compare-photos.flow.md](../../../architecture/contexts/private-photos/flows/compare-photos.flow.md) · PRD: [FR-PP-008..010](../../../prd/features/private-photos.md#fr-pp-008) · Component: [PhotoCompare](../../../architecture/components.md#photocompare).

## Files in scope

**Modify**

- `src/lib/contexts/private-photos/domain/private-photos.types.ts` — add `PhotoCompareRules`, `CompareModes`, `CompareMode`, `ComparePhotoView`, `PhotoComparison`, `SamePhotoError` (Phase 1 constants already live in this file).
- `src/lib/contexts/private-photos/private-photos.composition.ts` — import `bodyWeightPort` from `body-metrics.composition` (story 11.1) and export `getPhotoComparisonUseCase`.
- `src/components/photo-gallery.astro` — extend the existing inline client script: long-press 500 ms selection, *Seleccionar* button, bottom bar *Comparar (2)*; the tap → fullscreen handler stays in the same script.
- `src/pages/photos.astro` — header button *Comparar* when the user has ≥ 2 photos.

**Create**

- `src/lib/contexts/private-photos/application/get-photo-comparison.use-case.ts` — constructor `(photoRepository: PhotoRepository, bodyWeightPort: BodyWeightPort)`.
- `src/pages/photos/compare.astro` — SSR auth gate (same shape as `photos.astro`), mounts `PhotoCompare` with `client:load`.
- `src/components/photos/photo-compare.tsx` — React island.
- Tests: `tests/private-photos/get-photo-comparison.use-case.test.ts`, `tests/private-photos/photo-compare.test.tsx`, `tests/private-photos/photo-gallery-select.test.ts`.

**Not in scope (must not change):** `PhotoRepository` (`src/lib/contexts/workout-tracking/domain/photo.repository.ts`) and its implementations, `src/pages/photos/file/[id].ts` (images use the existing authenticated route), `src/pages/api/photos/[id].ts`, `supabase/migrations/`, `db/schema.ts`. No new API endpoint: the comparison is SSR.

## Happy Path

1. The user with ≥ 2 photos taps *Comparar* on `/photos` (default pair) or long-presses a photo (500 ms), taps a second one and taps *Comparar (2)* ([FR-PP-010](../../../prd/features/private-photos.md#fr-pp-010)); a *Seleccionar* button enters the same mode without long-press.
2. `/photos/compare?a=<older>&b=<newer>` calls `GetPhotoComparisonUseCase.execute({ userId, photoAId?, photoBId? })`. Without `a`/`b` the pair is oldest vs newest by `photoDate` (ties by `createdAt`).
3. `PhotoCompare` shows the header "N días entre fotos" ("1 día" in singular) and a mode switch ([FR-PP-008](../../../prd/features/private-photos.md#fr-pp-008)): *Lado a lado* (two 3:4 columns with the date under each) and *Deslizador* (both images in one frame, right image clipped by `clip-path: inset(0 0 0 X%)`, draggable divider starting at 50 %).
4. When `BodyWeightPort.findNearest(userId, photoDate, 3)` finds a weight within ±3 days, it shows under the date of each photo, with the Δ between them ([FR-PP-009](../../../prd/features/private-photos.md#fr-pp-009)), in the viewer's unit.
5. *Intercambiar* swaps sides client-side and rewrites the query with `history.replaceState`, so a reload keeps the swap; tapping a side's date opens a thumbnail picker of all the owner's photos and navigates with the new `a`/`b`.
6. A missing or foreign photo id → 404 page; the same id twice → redirect to `/photos/compare` (defaults); fewer than 2 photos → empty state "Necesitas al menos 2 fotos para comparar" with *Subir foto*.

## Decisions

- **Multi-select extends the gallery's inline script** instead of a new React island: long-press and the existing tap → fullscreen handler must share one event handler to avoid racing. This is the code-reality exception to the React-only rule ([ADR-015](../../../architecture/decisions/015-live-workout-react-island.md)); `PhotoCompare` itself is a React island.
- **Equal distance** (one measurement before, one after the photo date) uses the earlier one (simplest; neither Hevy nor Gravl has the feature).
- **404 for both "missing" and "not yours"** so a photo id never reveals existence (`PhotoOwnershipError` and `undefined` map to the same page).
- **Server keeps URL order** (`a` left, `b` right); swap is client-only.
- **Weight formatting** uses the same 1-decimal display helper as body-metrics (`toDisplay`); the photo-compare readme shows a decimal comma in the example while other docs use a point, so the story follows the shared helper and the docs are aligned in the last task.
- **`daysBetween`** is `round(|right.photoDate − left.photoDate| / 86 400 000)` so a DST change still counts whole days.

## Acceptance Criteria

- AC-11.3-01: With no `a`/`b`, the comparison uses the oldest and newest photo by `photoDate` (ties by `createdAt`); with explicit ids the URL order is kept (`a` left, `b` right).
- AC-11.3-02: Another user's photo id → `PhotoOwnershipError` mapped to the same 404 page as an unknown id; `/photos/compare?a=<sibling photo>` returns 404 and never renders the image.
- AC-11.3-03: `a` equal to `b` → `SamePhotoError` and a redirect to `/photos/compare`; fewer than 2 photos → `undefined` and the empty state with *Subir foto*.
- AC-11.3-04: A weight 3 days from the photo date is used, 4 days away is not; with equal distance the earlier measurement wins; the Δ (right − left) appears only when both weights exist; without a measurement no weight line renders (round AC-R11-04).
- AC-11.3-05: `daysBetween` counts whole days across a DST change; the header reads "N días entre fotos" and "1 día" for one day.
- AC-11.3-06: *Lado a lado* and *Deslizador* both render; the slider starts at 50 %, is draggable with pointer capture, and the handle is `role="slider"` with `aria-valuenow` and moves 5 % per arrow key; *Intercambiar* swaps sides and a reload keeps the swap.
- AC-11.3-07: Gallery multi-select: a 500 ms long-press (cancelled by > 10 px movement or early release) enters selection mode, at most 2 photos can be checked (a third tap is ignored with the hint "Elige 2 fotos"), *Comparar (2)* opens `/photos/compare?a=<older>&b=<newer>`, *Cancelar* exits; *Seleccionar* does the same without long-press; the *Comparar* header button (≥ 2 photos) opens the default pair; the Phase 1 tap → fullscreen modal and delete still work.
- AC-11.3-08: Photos stay owner-only: bytes only come from the authenticated `/photos/file/[id]` route; body weight comes only from the session user's own measurements through `BodyWeightPort` and is never computed or shown for another user (ADR-005, ADR-023); no schema, migration or RLS change, and both backends (`STORAGE_BACKEND=sqlite|supabase`) behave the same.

## Tasks

- [ ] `T11.3-01` - Add `PhotoCompareRules`, `CompareModes`, `PhotoComparison`, `ComparePhotoView`, `SamePhotoError` to `private-photos.types.ts`.
- [ ] `T11.3-02` - `GetPhotoComparisonUseCase` (default pair, ownership via `PhotoRepository.findById(id, currentUserId)`, `findNearest` in parallel, `daysBetween`, Δ, `toPhotoView`); use-case tests with the real `SqlitePhotoRepository` and the real body-metrics `BodyWeightPort`.
- [ ] `T11.3-03` - Export `getPhotoComparisonUseCase` from `private-photos.composition.ts`.
- [ ] `T11.3-04` - `src/pages/photos/compare.astro` (auth gate, 404 / redirect / empty state mapping).
- [ ] `T11.3-05` - `PhotoCompare` island: header, mode switch, side-by-side, slider with a11y, *Intercambiar*, thumbnail picker.
- [ ] `T11.3-06` - Gallery multi-select in `photo-gallery.astro` (long-press, *Seleccionar*, bottom bar, third-tap hint) and the *Comparar* button in `photos.astro`; regression test of the tap → fullscreen path.
- [ ] `T11.3-07` - E2E scenario (Playwright, run by story 12.5): sibling photo id → 404.
- [ ] `T11.3-08` - Update docs: mark the context Use Cases row (`GetPhotoComparisonUseCase`) `implemented`, fix any doc/code drift found (decimal separator in the compare example), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/private-photos/get-photo-comparison.use-case.test.ts` | use-case (real SQLite) | default pair, explicit order, foreign id → ownership error, unknown → `undefined`, same id → `SamePhotoError`, one photo → `undefined`, ±3 days window, tie → earlier, Δ only with both, DST (01–05, 08) |
| `tests/private-photos/photo-compare.test.tsx` | component | header singular / plural, modes, slider keyboard step and `aria-valuenow`, swap via `replaceState` (05, 06) |
| `tests/private-photos/photo-gallery-select.test.ts` | unit (DOM script) | long-press timing and cancel, max 2, hint, *Seleccionar*, fullscreen tap still works (07) |
| `tests/supabase/rls-photo.integration.test.ts` (existing) | integration-RLS (gated) | unchanged: owner-only `progress_photos` still holds (08) |
| `tests/e2e/photos-compare-foreign.spec.ts` (Playwright, wired in 12.5) | e2e | `/photos/compare?a=<sibling photo>` → 404 (02) |

Reuses `PhotoMother` of the existing photo tests and `BodyMeasurementMother.weightOnly(kg, date)` from story 11.1.

## Out of Scope

- Body measurements UI, charts and `BodyWeightPort` itself → story 11.1.
- Uploading, deleting and storage rules of photos → Phase 1 (story 4.2, 6.3).
- Offline use of the comparison → not planned (SSR page, needs the network).
- Sharing a comparison image → not planned (photos are never shared, ADR-005).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
