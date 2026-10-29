---
story_id: "12.2"
round: "round-12"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/social/readme.md"
size: "S"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["social"]
  prd_requirements: ["FR-SO-008"]
  architecture_decisions: ["ADR-024"]
  flows: ["share-workout-image.flow.md"]
blocked_by: ["story-10.1", "story-12.1"]
blocks: ["story-12.5"]
---

# Story 12.2 — Share workout as image

Parent: [../readme.md](../readme.md)

## Summary

The owner of a completed workout taps *Compartir* and gets a 1080 × 1350 PNG drawn on a client-side canvas (light theme, logo, name, date, duration, volume, sets, up to 3 PRs, up to 6 exercises), sent through the Web Share API or downloaded as `gymup-{date}.png`. The server only builds the numbers (`GenerateShareImageDataUseCase`, owner-only); no image is generated or stored on the server and no endpoint serves the data. Closes Hevy row **H21** and round criterion AC-R12-02 (no body metrics or photos in the image).

## Files in scope

**Modify**

- `src/lib/contexts/social/social.composition.ts` — export `generateShareImageDataUseCase` (`FeedQueryRepository` + `PrCountPort`).
- `src/components/social/social-format.ts` — add `RecordLabelsEs`, `formatRecordValue(type, value, unit)`.
- `src/pages/workouts/[id].astro` — owner of a completed workout: SSR calls the use case and passes `ShareImageData` to `ShareImageButton`.
- `src/pages/workout/[id].astro` — summary v2 (owner, completed): same button and prop.
- `docs/architecture/contexts/social/readme.md`, `docs/architecture/contexts/social/flows/share-workout-image.flow.md`, `docs/architecture/components.md` — final task.

**Create**

- `src/lib/contexts/social/application/generate-share-image-data.use-case.ts`.
- `src/components/social/share-image-button.tsx` (island, `client:visible`).
- `src/components/social/share-image-layout.ts` — pure: block boxes, `wrapText(text, maxWidth, measure, maxLines)`, `truncateToWidth`, `computeShareLayout(...)`.
- `src/components/social/share-image-canvas.ts` — draws the layout on an off-DOM `<canvas>`; imports only `ShareImageData` types and `social-format.ts`.
- `src/components/social/share-image-file.ts` — pure helpers: `shareFileName(completedAt, timezone)`, `shareOrDownload(blob, file, deps)`.
- `tests/social/generate-share-image-data.use-case.test.ts`, `share-image-layout.test.ts`, `share-image-file.test.ts`, `record-labels.test.ts`.

**Not in scope (must not change)**: `db/**`, `supabase/**` (no table, no migration, no RLS change); `FeedQueryRepository` and `PrCountPort` contracts; any server route that returns share data.

## Happy Path

1. The owner opens `/workouts/[id]` of a completed workout, or the summary after finishing. SSR calls `generateShareImageDataUseCase.execute({ workoutId, userId })` and passes the resulting `ShareImageData` to `ShareImageButton` as a prop (FR-SO-008).
2. The owner taps *Compartir*. The button shows "Generando…" (disabled), waits for `document.fonts.ready` and decodes `/favicon.svg`.
3. `share-image-canvas.ts` draws the 1080 × 1350 light-theme image block by block (brand + date, title, stats, PRs if any, exercises).
4. `canvas.toBlob` produces a PNG `File` named `gymup-{yyyy-mm-dd}.png` (date in the owner's timezone).
5. If `navigator.canShare({ files })` is true the mobile share sheet opens; otherwise the file downloads. The button returns to *Compartir*.

## Decisions

| # | Decision |
|---|---|
| D1 | Numbers use `new Intl.NumberFormat('es', { useGrouping: 'always' })`. Plain `'es'` does not group 4-digit numbers ("8240"), while the flow doc example shows "8.240 kg". |
| D2 | `social-format.ts` keeps a local `RecordLabelsEs` copy of progress `RecordLabels` (social does not import other contexts' domain files); `record-labels.test.ts` fails when the key sets or strings drift. |
| D3 | `formatRecordValue`: `heaviest_weight`, `best_1rm`, `best_set_volume`, `best_session_volume`, `least_assistance` → weight in the owner's unit ("95 kg"); `most_reps` → "N reps"; `longest_duration` → `m:ss` / `h:mm:ss`; `longest_distance` → km with ≤ 2 decimals from 1000 m, else "N m"; `best_pace` → `m:ss /km` (s/m × 1000). (Hevy shows the value only; simplest per-type unit.) |
| D4 | Drawing is split into a pure layout module (testable in vitest, which has no canvas) and a thin canvas module. Pixel output is verified in a real browser (manual checklist now, Playwright in story 12.5, H21). |
| D5 | Dependency note: the story uses `social.types.ts`, `social.rules.ts`, `FeedQueryRepository`, `social.composition.ts`, `social-format.ts` and the `/workouts/[id]` page from [story 12.1](./story-12.1.md), although the phase table lists only 10.1 as blocker. Schedule 12.2 after 12.1; if it must land first it creates those files with the shapes in the social readme and 12.1 extends them. |

## Acceptance Criteria

- AC-12.2-01 (FR-SO-008): for the owner of a completed workout, `GenerateShareImageDataUseCase` returns `workoutName`, `completedAt`, owner `timezone` and `weightUnit`, `durationSeconds`, `volumeKg` (no body weight, `max(0, weight) × reps`), `setCount` (completed, non-deleted, warm-ups included), `prCount` = total PRs, `prs` = first `ShareImageRules.MaxPrs` (3) in exercise position order, `exercises` = first `MaxExercises` (6) with `pickBestSet`, and `extraExerciseCount`. It also works for a Phase 1 completed workout.
- AC-12.2-02: another user's workout → `NotWorkoutOwnerError` (403); a missing or `in_progress` workout → `WorkoutNotVisibleError` (404). No API route returns `ShareImageData`: only the owner's SSR page passes it as a prop, and non-owners get no button.
- AC-12.2-03 (privacy, AC-R12-02): the keys of `ShareImageData` are exactly the 11 declared fields (no display name, body metrics or weight, photos, readiness, nutrition, e-mail); `share-image-canvas.ts` reads only `ShareImageData`, so the PNG cannot contain them.
- AC-12.2-04: *Compartir* renders for the owner of a completed workout on `/workouts/[id]` and on the summary v2; it does not render for other users, for an `in_progress` workout, or when the use case throws.
- AC-12.2-05: the canvas is `ShareImageRules.WidthPx × HeightPx` (1080 × 1350) with the fixed light palette (`#FFFFFF`, `#111827`, `#6B7280`, `#E5E7EB`) regardless of the app theme. `computeShareLayout` places the exercises block at y = 576 without PRs and y = 808 with PRs, and the worst case (3 PRs, 6 exercises, "+N ejercicios") ends at y = 1256 (≤ 1278).
- AC-12.2-06: text rules hold: the workout name wraps to at most 2 lines and ends with "…" if longer; exercise names are truncated with "…" at 600 px; the date reads "1 de octubre de 2026" in the owner's timezone; duration "1 h 12 min" or "48 min"; volume "8.240 kg" (D1) in the owner's unit; the PR heading is "🏆 Récords" or "🏆 Récords (N)" when `prCount > 3`; "+N ejercicios" appears only when `extraExerciseCount > 0`; each PR line reads "Bench Press · Mejor 1RM · 95 kg" (`RecordLabelsEs`, `formatRecordValue`).
- AC-12.2-07: the file is `gymup-{yyyy-mm-dd}.png` with the date in the owner's timezone (a workout completed at 2026-10-02T02:30Z in `America/Caracas` is named `gymup-2026-10-01.png`). With `navigator.canShare({ files })` the image goes through `navigator.share({ files, title })`; otherwise it downloads through a temporary `<a download>` and the object URL is revoked. `AbortError` does nothing (no toast, no download); any other share error downloads the file and shows "No se pudo compartir; la imagen se descargó".
- AC-12.2-08: while drawing, the button shows "Generando…" and is disabled; fonts not ready after 2 s fall back to `sans-serif`; if the logo fails to decode, block 1 draws the text "Gym Up" only; a bodyweight-only workout still draws, with volume "0 kg".
- AC-12.2-09 (parity): the use case returns identical data through the SQLite and Supabase repositories. The story adds no table, so no migration, RLS or Phase 1 fixture test is required; AC-12.2-01 covers a Phase 1 workout.

## Tasks

- [ ] `T12.2-01` - `GenerateShareImageDataUseCase` (header check → owner check → sets → `summarizeWorkout` → `PrCountPort.listByWorkout` → slices) and its export in `social.composition.ts`.
- [ ] `T12.2-02` - `social-format.ts`: `RecordLabelsEs`, `formatRecordValue`, share-specific number formatting (D1).
- [ ] `T12.2-03` - `share-image-layout.ts`: block boxes from the flow table, `wrapText`, `truncateToWidth`, `computeShareLayout`.
- [ ] `T12.2-04` - `share-image-canvas.ts`: draw blocks 1–5 on an off-DOM canvas, font and logo waits with the 2 s fallback.
- [ ] `T12.2-05` - `share-image-file.ts` (file name, share-or-download with injected `navigator`-like deps) and `share-image-button.tsx` (states, toasts).
- [ ] `T12.2-06` - Wire the button into `/workouts/[id]` and the summary v2 (owner and completed only; SSR prop).
- [ ] `T12.2-07` - Tests: use case, layout (worked examples below), file helpers, `record-labels.test.ts`.
- [ ] `T12.2-08` - Manual verification: Android Chrome share sheet, desktop download, worst-case image (3 PRs, 6 exercises, "+N") and a no-PR image; attach both PNGs as evidence.
- [ ] `T12.2-09` - Update docs: mark `GenerateShareImageDataUseCase` `implemented`, fix doc/code drift found (the "8.240" grouping note in the flow, `ShareImageButton` props in `components.md` vs `ShareImageData`), add Implementation Evidence.

## Test Plan

Layout worked examples (`share-image-layout.test.ts`):

| Case | PR block | Exercise rows | "+N" row | Exercises block y | Content ends at y |
|---|---|---|---|---|---|
| No PRs, 6 exercises, extra | no | 6 | yes | 576 | 576 + 56 + 6 × 58 + 44 = 1024 |
| 3 PRs, 6 exercises, extra (worst case) | yes | 6 | yes | 808 | 808 + 56 + 6 × 58 + 44 = 1256 |
| 1 PR, 2 exercises | yes | 2 | no | 808 | 808 + 56 + 2 × 58 = 980 |

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/social/generate-share-image-data.use-case.test.ts` | use-case | Owner data, ≤ 3 PRs and ≤ 6 exercises, `extraExerciseCount`, total `prCount`, Phase 1 workout, non-owner and not-completed errors, exact key set, bodyweight workout volume (01, 02, 03, 08, 09) |
| `tests/social/share-image-layout.test.ts` | unit (table) | Block boxes, y positions above, `wrapText` with a fixed-width `measure` function (2 lines + "…"), `truncateToWidth`, duration / volume / date / PR heading formatting (05, 06) |
| `tests/social/share-image-file.test.ts` | unit | File name in the owner timezone (Caracas edge), share vs download decision, `AbortError` silent, other error falls back (07) |
| `tests/social/record-labels.test.ts` | unit | `RecordLabelsEs` equals progress `RecordLabels`; `formatRecordValue` per record type (06) |
| Browser check (manual now, Playwright in [12.5](./story-12.5.md), H21) | e2e | PNG is 1080 × 1350, download triggered, button states, no private text drawn (03, 04, 05, 07, 08) |

## Out of Scope

- Server-side image generation, stored images, share links → not planned (client canvas only).
- Sharing other users' workouts → never offered (owner only).
- Browser E2E of the download and PNG dimensions → [story-12.5](./story-12.5.md).
- Dark theme image, stickers or alternative templates: not planned (FR-SO-008 fixes one light layout).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
