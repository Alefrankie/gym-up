# Compare Photos Flow

Parent: [../readme.md](../readme.md) · Context: [../readme.md](../readme.md) · PRD: [FR-PP-008 … FR-PP-010](../../../../prd/features/private-photos.md#fr-pp-008)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [11.3](../../../../stories/phase-2/round-11/story-11.3.md) |
| Decisions | [ADR-005](../../../decisions/005-private-photos.md), [ADR-023](../../../decisions/023-body-metrics-privacy.md) |

## Happy Path

### Step 1 - Open the comparison

On `/photos` the user taps *Comparar* (shown with ≥ 2 photos), or long-presses a photo, selects a second one and taps *Comparar (2)* (FR-PP-010). The browser goes to `/photos/compare` (default pair) or `/photos/compare?a=<older>&b=<newer>`.

### Step 2 - Resolve the pair (server)

`compare.astro` checks the session and calls `getPhotoComparisonUseCase.execute({ userId, photoAId, photoBId })`:

1. Loads the user's photos (`PhotoRepository.findByUser`).
2. Without `a`/`b`: oldest vs newest. With them: `findById(id, userId)` for each (owner check).
3. `BodyWeightPort.findNearest(userId, photoDate, 3)` for both photos.
4. Computes `daysBetween` and, when both weights exist, `bodyWeightDeltaKg`.

### Step 3 - Side by side (default mode)

`PhotoCompare` renders "N días entre fotos", two columns with the date under each photo and, when found, the body weight ("72,4 kg") and the Δ ("−2,4 kg") in the user's unit ([ADR-006](../../../decisions/006-kg-storage.md)).

### Step 4 - Slider mode

The user taps *Deslizador*. Both photos are stacked; dragging the vertical divider reveals more of one or the other. Keyboard: arrow keys move it by 5 %.

### Step 5 - Swap or change a photo

*Intercambiar* swaps left and right client-side and rewrites the URL (`history.replaceState`). Tapping a side's date opens a picker of all the user's photos; choosing one navigates to the new `?a=&b=`.

---

## Edge Case: Fewer Than 2 Photos

The use case returns `undefined`. The page shows "Necesitas al menos 2 fotos para comparar" and *Subir foto*. The gallery hides *Comparar*.

## Edge Case: No Nearby Body Weight

No measurement with a weight within ±3 days of a photo: that photo shows no weight and no Δ is shown. The other side still shows its weight.

## Edge Case: Two Measurements Equally Close

One measurement 2 days before and one 2 days after: the earlier one is used.

## Edge Case: Same Day Photos

`daysBetween = 0` → "0 días entre fotos". Allowed.

## Edge Case: Third Selection In the Gallery

In selection mode, with 2 photos already checked, a third tap is ignored and the hint "Elige 2 fotos" is shown.

## Failure: Same Photo Twice

`?a=X&b=X` → `SamePhotoError` → redirect to `/photos/compare` (default pair).

## Failure: Another User's Photo or Unknown Id

`findById` throws `PhotoOwnershipError` or returns `undefined` → 404. The response is the same in both cases, so photo ids of siblings cannot be probed ([ADR-005](../../../decisions/005-private-photos.md)).

## Failure: Not Logged In

No session → redirect to `/login`, as on `/photos`.
