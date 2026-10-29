---
story_id: "9.4"
round: "round-9"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/user/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking", "user"]
  prd_requirements: ["FR-WT-037", "FR-WT-044", "FR-WT-045"]
  architecture_decisions: []
  flows: []
blocked_by: ["story-9.1"]
blocks: ["story-9.5", "story-11.1"]
---

# Story 9.4 — Navigation v2, profile hub, training settings

Parent: [../readme.md](../readme.md)

## Summary

Replaces the Phase 1 sidebar with the four-tab shell (*Inicio*, *Entrenar*, *Progreso*, *Perfil*) and the in-progress banner, adds the `/profile` hub, and rebuilds `/settings` into sections with the training settings of [FR-WT-037](../../../prd/features/workout-tracking.md#fr-wt-037) (`UpdateTrainingSettingsUseCase`, kept in workout-tracking next to `UpdateProfileUseCase` as the [user context readme](../../../architecture/contexts/user/readme.md#settings-use-cases-where-they-live) prescribes). The island already reads these settings through `TrainingSettings` since 9.1; this story lets the user change them. Closes the shell part of the Hevy parity rows.

## Files in scope

**Modify**

- `src/layouts/app-layout.astro` — the authenticated layout (the docs say `layout.astro`, which is the marketing page): render `TabBar` instead of `Navigation`, render `InProgressBanner`, accept `hideTabBar`.
- `src/pages/workout/[id].astro` — pass `hideTabBar` for the live and edit views.
- `src/pages/settings.astro` — sections per the user readme; remove the routine-type radio.
- `src/lib/contexts/workout-tracking/domain/profile.repository.ts` (`ProfilePatch`), `.../infrastructure/sqlite/sqlite-profile.repository.ts`, `.../supabase/supabase-profile.repository.ts`.
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — export `updateTrainingSettingsUseCase`.
- `src/lib/contexts/workout-tracking/domain/workout.repository.ts` (+ implementations) — add `countCompletedByUser`.
- `tests/workout-tracking/sqlite-profile.repository.test.ts`.

**Create**

- `src/components/navigation/tab-bar.astro`, `src/components/navigation/in-progress-banner.tsx`, `src/components/navigation/active-tab.ts` (`resolveActiveTab`, `isTabBarHidden`).
- `src/lib/app-shell/shell-features.ts` — flags for links whose pages land in later stories.
- `src/pages/profile/index.astro` (hub). `/train` is created by story 8.2; this story creates a minimal `src/pages/train/index.astro` only if 8.2 has not shipped it (see Decisions).
- `src/lib/contexts/workout-tracking/application/update-training-settings.use-case.ts`.
- `src/lib/contexts/workout-tracking/application/settings-form.ts` (`parseSettingsForm(formData)` → `{ section, input }`: pure parsing of one section's POST body into use-case input, so the PRG handling in `settings.astro` stays thin and testable).
- `src/components/settings/plates-editor.tsx` (island: chips, add, remove, writes a hidden `availablePlates` field).
- Tests: see [Test Plan](#test-plan).

**Delete**

- `src/components/navigation.astro` (no page imports it after the layout switch).

**Not in scope** (must not change): `src/lib/contexts/workout-tracking/application/update-profile.use-case.ts` and its tests; `db/`, `supabase/migrations/` (the 004 columns ship in 7.1); columns owned by routines, progression and social.

## Decisions

- `UpdateProfileUseCase` is left unchanged (it still accepts `routineType` and `weightUnit` for Phase 1 callers and tests); `/settings` simply stops sending `routineType`, sends `displayName` to it and `weightUnit` to `UpdateTrainingSettingsUseCase`. This follows the user readme over the workout-tracking readme, which says the use case drops those inputs.
- `UpdateTrainingSettingsUseCase` takes `timezone` as well (user readme) and allows 1–12 plates (`MaxPlateKinds = 12`); the workout-tracking readme's 1–15 is superseded by the user readme, which is the spec written for this story.
- `ProfilePatch` widens to the settings-owned columns only; `activeProgramId`, deload columns and `activitySeenAt` are never in it.
- Layout resolves the session itself and calls `getActiveWorkoutUseCase` (9.1); it hides the banner on `/workout/{activeId}`. The banner re-checks `GET /api/workouts/active` on `pageshow` (back-forward cache) and hides on `204`; no custom event is needed.
- `TabBar` is hidden on `/`, `/login`, `/register`, `/onboarding` and on `/workout/[id]` while in progress or in edit mode (full height). `resolveActiveTab`: `/dashboard` → `inicio`; `/train*`, `/exercises*`, `/workout/*` → `entrenar`; `/progress*` → `progreso`; `/profile*`, `/history`, `/settings`, `/photos*`, `/nutrition*`, `/family*`, `/workouts/*` → `perfil`. `hasUnseenActivity` is always `false` until story 12.1.
- `/train` is owned by 8.2 (routines readme) although the phase table lists it in this round. If 8.2 has not shipped, 9.4 adds a minimal page with *Entrenamiento libre* (`StartWorkoutButton`, mode `empty`) and a link to `/exercises`; 8.2 replaces it.
- The hub shows a *Familia* link to `/family` (Phase 1 page) so family visibility does not disappear from the navigation; story 12.1 moves the feed to *Inicio* and removes the link.
- `ShellFeatures` flags (`measurements` 11.1, `tools` 9.5, `exportData` 12.4, `changeProgram` 8.4, `deloadStatus` 10.3, `weeklyStreak` 11.2) default to `false`; the story that ships the page flips its flag in the same PR. Links and settings rows behind a `false` flag are not rendered ([phase rule 7](../readme.md#7-forward-compatible-ui)).
- Hub *Racha* shows the Phase 1 day streak (`calculateStreakUseCase`) until 11.2; "total de entrenamientos" counts **completed** workouts through `countCompletedByUser`.
- *Descanso por defecto* is a select of presets (Sin temporizador, 30 s, 45 s, 60 s, 90 s, 120 s, 150 s, 180 s, 240 s, 300 s) plus the stored value when it is not a preset; the server accepts any integer in [0, 600].
- The timezone select is preselected with the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` through a small inline script only while the stored value is still `UTC` (Hevy uses the device timezone).

## Happy Path

1. Any authenticated page renders the `TabBar` at the bottom (mobile) or top (desktop); the active tab follows the route ([FR-WT-044](../../../prd/features/workout-tracking.md#fr-wt-044)).
2. With a workout in progress, `InProgressBanner` sits above the tab bar: "Entrenamiento en curso · 00:42:10 · Continuar"; tapping it opens `/workout/[id]` ([FR-WT-019](../../../prd/features/workout-tracking.md#fr-wt-019)).
3. User opens *Perfil*: name, total workouts, day streak and links to Historial, Fotos, Nutrición, Familia, Ajustes and *Cerrar sesión* ([FR-WT-045](../../../prd/features/workout-tracking.md#fr-wt-045)).
4. *Ajustes* opens `/settings`. In *Entrenamiento* the user switches to lbs: the bar and plates switch to 45 lb and the lb plate set when they were still the kg defaults; saves with PRG back to `/settings?saved=entrenamiento#entrenamiento`.
5. User sets *Descanso por defecto* to "Sin temporizador" (0), edits the plate chips, enables *Registrar RPE*; the next live workout reflects them ([FR-WT-037](../../../prd/features/workout-tracking.md#fr-wt-037)).
6. In *Progresión* user toggles *Sugerencias de progresión* and *Check-in de energía*; in *Cuenta* user changes name and timezone.

## Acceptance Criteria

- AC-9.4-01: `TabBar` renders four tabs (🏠 Inicio `/dashboard`, 🏋 Entrenar `/train`, 📊 Progreso `/progress`, 👤 Perfil `/profile`) with `aria-current="page"` on the active one; on mobile (< 768 px) a fixed bottom bar with targets ≥ 56 px and `padding-bottom: env(safe-area-inset-bottom)`; on desktop the same links in the top bar; the `hasUnseenActivity` dot renders only when true.
- AC-9.4-02: `resolveActiveTab` and `isTabBarHidden` table tests cover every route family in the decisions, including `/workout/[id]` in progress, `?mode=edit` and a completed workout.
- AC-9.4-03: Every page that used `app-layout.astro` renders the `TabBar` and, when `GetActiveWorkoutUseCase` returns a workout, the banner; no page imports `navigation.astro`; the tab bar is absent on `/`, `/login`, `/register`, `/onboarding` and the live workout ([AC-R9-06](./readme.md#acceptance-criteria-round-level)).
- AC-9.4-04: `InProgressBanner` shows the name and an elapsed clock derived from `startedAt` (ticks every second), the whole bar is a ≥ 48 px link to `/workout/[id]`, it is not rendered on that workout's own page, it sits sticky above the tab bar, and on `pageshow` it re-checks the active endpoint and disappears on `204`.
- AC-9.4-05: `/profile` shows display name, total completed workouts, the Phase 1 day streak and the links Historial, Fotos, Nutrición, Familia, Ajustes and *Cerrar sesión* (which ends the session); links behind a `false` `ShellFeatures` flag (Medidas, Herramientas, Exportar datos) are not rendered; unauthenticated access redirects to `/login`.
- AC-9.4-06: `/settings` has the sections *Entrenamiento*, *Programa* (active program name and *Ver programas* → `/train`), *Progresión* (two toggles; deload row only when its flag is on), *Cuenta* (name, timezone, calorie goal, *Cerrar sesión*) and *Exportar datos* only when its flag is on. Each section is its own `<form method="post">` with a hidden `section` field; success redirects to `/settings?saved=<section>#<section>`; a validation error in one section keeps the others' values. The routine-type radio is gone.
- AC-9.4-07: `UpdateTrainingSettingsUseCase` validates before any write: rest integer in [0, 600] (0 and 600 valid, −1 and 601 `InvalidRestSecondsError`); bar in [0, 50] kg after conversion (`InvalidBarWeightError`); plates 1–12 distinct values in (0, 50] kg, stored sorted descending (`InvalidPlatesError` for empty, duplicates, > 50 kg or 13 values); `weightUnit` ∈ kg/lbs (`InvalidWeightUnitError`); timezone a valid IANA name (`InvalidTimezoneError`).
- AC-9.4-08: lb input converts with `0.45359237` and is stored unrounded (a 45 lb bar stores ≈ 20.41 kg and displays 45); when `weightUnit` changes and the stored bar and plates still equal the old unit's defaults they switch to the new unit's defaults, customized values are kept.
- AC-9.4-09: The use case writes only settings-owned columns: a call never changes `activeProgramId`, deload columns, `activitySeenAt`, `routineType` or `displayName` (test through the repository).
- AC-9.4-10: *Descanso por defecto* 0 displays "Sin temporizador"; the plates editor adds and removes chips, rejects duplicates and values above 50 kg client-side, and submits a hidden JSON field; the timezone select preselects the browser zone only while the stored value is `UTC`.
- AC-9.4-11: Both backends: `ProfileRepository.update` with the widened `ProfilePatch` works on SQLite and Supabase, and `availablePlatesKg` round-trips as a `number[]`. Supabase RLS: as a non-owner, updating another profile's training settings affects 0 rows; the owner's update succeeds.
- AC-9.4-12: Phase 1 regression: profiles from the Phase 1 fixture read the 004 defaults (90 s, 20 kg, default plates, RPE off, progression and readiness on, `UTC`), `/settings` renders for them, and saving a section leaves `routineType` untouched.

## Tasks

- [ ] `T9.4-01` - `ProfilePatch` widening in `profile.repository.ts` plus `SqliteProfileRepository` and `SupabaseProfileRepository` (JSON round trip of `availablePlatesKg`)
- [ ] `T9.4-02` - `UpdateTrainingSettingsUseCase`, `TrainingSettingsRules`, typed errors, composition export; reuse `units.ts` from 9.2 for lb → kg
- [ ] `T9.4-03` - `WorkoutRepository.countCompletedByUser` (abstract class, SQLite, Supabase)
- [ ] `T9.4-04` - `active-tab.ts` with table tests; `tab-bar.astro`
- [ ] `T9.4-05` - `in-progress-banner.tsx` and the `app-layout.astro` rewrite (session lookup, `getActiveWorkoutUseCase`, `hideTabBar`); pass `hideTabBar` from `/workout/[id]`; delete `navigation.astro`
- [ ] `T9.4-06` - `shell-features.ts` and `/profile` hub page
- [ ] `T9.4-07` - Minimal `/train` page only if story 8.2 has not shipped it
- [ ] `T9.4-08` - `/settings` v2: `settings-form.ts`, section forms, PRG handling, `plates-editor.tsx`, timezone preselect script, remove routine-type radio
- [ ] `T9.4-09` - Tests: use case, repositories, `active-tab`, `settings-form`, banner component, Supabase RLS, Phase 1 regression, manual checklist
- [ ] `T9.4-10` - Update docs: mark context Use Cases row `UpdateTrainingSettingsUseCase` `implemented`, fix any doc/code drift found (`layout.astro` vs `app-layout.astro`, plate limit 12 vs 15, `UpdateProfileUseCase` inputs), add Implementation Evidence

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/workout-tracking/update-training-settings.use-case.test.ts` | use-case | Rest bounds, bar bounds, plate rules, timezone, lb → kg, unit switch defaults, patch never touches foreign columns (07, 08, 09) |
| `tests/workout-tracking/sqlite-profile.repository.test.ts` | repo | Widened `update`, JSON round trip, defaults on Phase 1 rows (09, 11, 12) |
| `tests/workout-tracking/active-tab.test.ts` | unit (table) | Route → tab and hidden-tab cases (02) || `tests/workout-tracking/sqlite-workout.repository.test.ts` | repo | `countCompletedByUser` ignores in-progress (05) |
| `tests/workout-tracking/settings-form.test.ts` | unit (table) | Each section's POST body → use-case input, hidden `section`, plates JSON, blank and malformed values (06, 10) |
| `tests/workout-tracking/in-progress-banner.test.tsx` | component (happy-dom, real component, injected clock prop) | Name, ticking elapsed clock, link target, hide on `204` after `pageshow` (04) |
| manual checklist in Implementation Evidence (360 px and desktop screenshots) | manual | Tab bar on every page family, hidden routes, banner above the bar, `/profile`, `/settings` sections and PRG (01, 03, 05, 06) |
| `tests/supabase/rls-profile-settings.integration.test.ts` | integration-RLS | Non-owner update affects 0 rows; owner succeeds (11) |
| `tests/workout-tracking/phase-1-fixture.regression.test.ts` | regression | Defaults on migrated profiles; `routineType` untouched (12) |

## Out of Scope

- Active program switching, onboarding questionnaire, *Cambiar programa* → story 8.4; the `/train` page proper → story 8.2.
- Deload status and *Terminar descarga* → story 10.3; measurements link and page → [story-11.1](../round-11/story-11.1.md); weekly streak → [story-11.2](../round-11/story-11.2.md); export links → [story-12.4](../round-12/story-12.4.md).
- Plate calculator, warm-up generator, 1RM page behind *Herramientas* → [story-9.5](./story-9.5.md).
- Feed and activity dot on *Inicio* → [story-12.1](../round-12/story-12.1.md).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
