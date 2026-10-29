---
story_id: "7.3"
round: "round-7"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/exercise-library/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["exercise-library"]
  prd_requirements: ["FR-EL-001", "FR-EL-002", "FR-EL-003", "FR-EL-004", "FR-EL-005", "NFR-EL-01"]
  architecture_decisions: ["ADR-017"]
  flows: ["browse-exercises.flow.md", "pick-exercises.flow.md"]
blocked_by: ["story-7.2"]
blocks: ["story-7.4", "story-8.2", "story-9.1"]
---

# Story 7.3 — Exercise library browse, detail & picker

Parent: [../readme.md](../readme.md)

## Summary

Ships the read side of the [exercise-library context](../../../architecture/contexts/exercise-library/readme.md): the `/exercises` list with search, filters and *Recientes*, the exercise detail page, the reusable `ExercisePicker` (add mode with ordered multi-select, replace mode) and the read-only `ExerciseCatalogPort` that other contexts consume. The picker is consumed by the routine builder (8.2) and the live workout (9.1). It closes the browsing half of H11 (search and filters) and the picker part of H2 and H13. The detail tabs *Historial*, *Gráficas* and *Récords* render a neutral "Disponible pronto" placeholder until their data exists ([phase rule 7](../readme.md#7-forward-compatible-ui)).

## Files in scope

**Modify**

- `src/components/navigation.astro` — add the link `{ href: '/exercises', label: 'Exercises', icon: '🏋️' }` (same English label style as the Phase 1 links) so the library is reachable before `/train` (8.2) and the navigation rework (9.4) exist. Story 9.4 replaces this navigation, so the link is temporary.

**Create** (paths follow the context layout; components are flat in `src/components/` as in the context readme)

- Domain, `src/lib/contexts/exercise-library/domain/`: `exercise-library.types.ts`, `exercise-library.errors.ts` (`ExerciseNotFoundError`), `exercise-filter.ts`, `exercise-pickability.ts`, `picker-selection.ts`, `exercise-catalog.repository.ts`, `custom-exercise.repository.ts` (declares only `hasLoggedSets`; 7.4 adds the writes), `exercise-catalog.port.ts`.
- Application, `.../application/`: `list-exercises.use-case.ts`, `get-recent-exercises.use-case.ts`, `get-exercise-detail.use-case.ts`, `exercise-catalog.adapter.ts`, `list-route-handler.ts`.
- Infrastructure: `.../infrastructure/sqlite/sqlite-exercise-catalog.repository.ts`, `sqlite-custom-exercise.repository.ts`, `.../infrastructure/supabase/supabase-exercise-catalog.repository.ts`, `supabase-custom-exercise.repository.ts`.
- `src/lib/contexts/exercise-library/exercise-library.composition.ts` — exports `exerciseCatalogPort`, `getRecentExercisesUseCase`, `listExercisesUseCase`, `getExerciseDetailUseCase`.
- UI: `src/components/exercise-list-item.tsx`, `exercise-filters.tsx`, `exercise-picker.tsx`, `exercise-library-list.tsx` (island), `exercise-instructions.astro`; `src/lib/client/exercise-catalog.ts` (`loadExerciseCatalog`).
- Pages and API: `src/pages/exercises.astro`, `src/pages/exercises/[id].astro`, `src/pages/api/exercises.ts` (GET), `src/pages/api/exercises/[id].ts` (GET).
- Tests listed in the [Test Plan](#test-plan), including `tests/supabase/exercise-catalog.integration.test.ts`.

**Not in scope** (must not change): `db/schema.ts`, migrations, `exercise-library.constants.ts` (only imported), every workout-tracking, progress and routines file.

## Happy Path

1. The user opens `/exercises` from the new navigation link. The page checks the session (redirect to `/login` otherwise) and mounts `exercise-library-list`, which calls `loadExerciseCatalog()` once → `GET /api/exercises` → `ListExercisesUseCase`. Response: `{ exercises, recentIds }` (FR-EL-001, FR-EL-004).
2. With no query and no filter the island shows **Recientes** (up to 8, from `recentIds`) and then **Todos**, alphabetical and grouped by first letter. Each `ExerciseListItem` shows the English name, the Spanish primary-muscle and equipment labels, and "Personalizado" for custom exercises.
3. The user types in "Buscar ejercicio". After 150 ms the list filters in memory with `matchesExerciseFilter` (case- and accent-insensitive substring). Recientes is hidden while a query or filter is active (FR-EL-002, Hevy behaviour).
4. The user opens *Músculo* and *Equipo*, ticks values (OR within a group, AND across groups), sees removable chips and *Limpiar*.
5. The user taps a row → `/exercises/[id]`. Tab **Cómo hacerlo** (`?tab=como`, default) shows primary and secondary muscles, equipment, the type label, numbered instructions and *Ver video* when `videoUrl` is set. **Historial**, **Gráficas** and **Récords** show "Disponible pronto" (FR-EL-003).
6. A host (routine builder, live workout) renders `ExercisePicker` with `mode` and `maxSelectable`. The user ticks rows; each shows its selection order (1, 2, 3 …); *Añadir (N)* calls `onConfirm(ids)` with the IDs in selection order (FR-EL-005). In `replace` mode a tap confirms immediately.
7. The host's write endpoint (later stories) re-validates IDs through `ExerciseCatalogPort.findUsableByIds(ids, userId)` — built and tested here.

## Decisions

- **Tabs not yet backed by data show a placeholder.** The context readme says an unshipped tab is "not rendered"; this story renders the tab labels with "Disponible pronto" instead, per [phase rule 7](../readme.md#7-forward-compatible-ui). Stories 10.1 (*Récords*) and 11.2 (*Gráficas*, *Historial*) replace the placeholders. The page still never imports progress code in this story.
- **`CustomExerciseRepository` is split across stories.** This story declares it with `hasLoggedSets` only (the detail page needs `isTypeLocked`); story 7.4 adds `create`, `update`, `archive`, `restore`.
- **Create actions are hidden.** *+ Crear ejercicio* (list, picker) and *Crear «{query}»* (empty search) appear in story 7.4; here the empty state shows only "No se encontraron ejercicios".
- **No component-testing library.** `package.json` has `happy-dom` but no Testing Library, and Vitest only collects `tests/**/*.test.ts`. Island tests are `.test.ts` files that mount with `react-dom/client` inside `act` under `// @vitest-environment happy-dom`, using `React.createElement`. The picker's selection rules live in the pure `picker-selection.ts` so most of AC-R7-04 is table-tested without a DOM. There is no demo page.
- **Route logic in a handler.** `list-route-handler.ts` (the `nutrition` context pattern) holds the ETag and 304 logic so it can be tested without Astro; the page file only wires session and response.
- **Cache headers.** `Cache-Control: private, no-cache`, `Vary: Cookie`, weak `ETag` = `W/"<sha1 of body>"`; a matching `If-None-Match` returns 304 with no body. The service worker (12.3) layers stale-while-revalidate on top.
- **Recientes source.** The 200 latest `workout_entries` of the user with `completed = 1` (any workout status), ordered by `COALESCE(completed_at, created_at) DESC`, deduplicated by exercise, filtered by `canPick`, first 8.
- **Errors are JSON** `{ error: { code, message } }` with 401 without a session and 404 for an unknown id.

## Acceptance Criteria

- AC-7.3-01: Given the 107 seeded exercises and one custom exercise of the user plus one of a sibling, `GET /api/exercises` returns system plus own non-archived rows sorted by `sortByName`, without the sibling's or archived ones, and the rows carry `isCustom` (FR-EL-001).
- AC-7.3-02: `GET /api/exercises?archived=1` returns only the user's archived custom exercises with `recentIds: []`.
- AC-7.3-03: `/exercises` renders each row with the English name, `MuscleGroupLabels` and `EquipmentLabels` labels, and "Personalizado" only when `isCustom`; a request without a session redirects to `/login` (FR-EL-001, FR-EL-011).
- AC-7.3-04: `normalizeSearchText` and `matchesExerciseFilter` match case- and accent-insensitively ("press" matches "Prèss"), combine groups with AND and values with OR, and an empty filter matches everything; typing triggers filtering 150 ms after the last keystroke (FR-EL-002).
- AC-7.3-05: With a query or a filter active the *Recientes* section is hidden; with none active it lists up to 8 exercises in `recentIds` order and is absent when `recentIds` is empty (FR-EL-004).
- AC-7.3-06: `GetRecentExercisesUseCase` scans the user's latest completed entries, deduplicates, orders by most recent, drops archived and non-pickable exercises and returns at most 8.
- AC-7.3-07: `/exercises/[id]` shows muscles, equipment, `ExerciseTypeLabels`, numbered instructions and *Ver video* (new tab, `rel="noopener noreferrer"`) only when `videoUrl` exists; `?tab=historial|graficas|records` shows "Disponible pronto"; an unknown `?tab=` falls back to *Cómo hacerlo* (FR-EL-003).
- AC-7.3-08: An unknown id renders the 404 page "Ejercicio no encontrado" with a link to `/exercises`; the API answers 404 JSON.
- AC-7.3-09: The detail of a sibling's custom exercise renders read-only with "Creado por {ownerDisplayName}", and an archived own exercise shows an "Archivado" badge; `GetExerciseDetailUseCase` returns `isOwn`, `canEdit`, `isTypeLocked` (true when any `workout_exercises` or `workout_entries` row references an own exercise).
- AC-7.3-10: `ExercisePicker` in `add` mode lists only pickable exercises (system, or own and non-archived), shows selection-order badges that renumber on deselect, keeps the selection while search or filters change, disables *Añadir (N)* at N = 0, and calls `onConfirm(ids)` in selection order (AC-R7-04).
- AC-7.3-11: In `replace` mode a tap calls `onConfirm([id])` immediately and closes; selecting beyond `maxSelectable` is blocked with the toast "Máximo 30 ejercicios"; backdrop, Escape and *Cancelar* call `onClose()` without `onConfirm` (FR-EL-005).
- AC-7.3-12: `canPick` returns `not_found`, `archived` or `not_owner`; `ExerciseCatalogAdapter.findUsableByIds` omits every id that `canPick` rejects, keeps system and own ids, and `findByIds` omits missing ids.
- AC-7.3-13: `GET /api/exercises` sends `ETag`, `Cache-Control: private, no-cache` and `Vary: Cookie`; a repeated request with `If-None-Match` returns 304; recents travel in the same response, so opening the picker needs one request (NFR-EL-01). Filtering the full 107-row catalog with a query and two filter groups finishes in < 50 ms (asserted over 100 runs).
- AC-7.3-14: A failed catalog request without cache shows "No se pudo cargar la biblioteca" with *Reintentar*; "No se encontraron ejercicios" shows for an empty result.
- AC-7.3-15: Both backends return the same list, detail and recents for the same data (`STORAGE_BACKEND=sqlite` unit tests, `=supabase` integration test), and the Supabase test as a non-owner can read a sibling's custom exercise by id but does not get it in `listForUser`.

## Tasks

- [ ] `T7.3-01` - `exercise-library.types.ts`, `exercise-library.errors.ts`, pure modules `exercise-filter.ts`, `exercise-pickability.ts`, `picker-selection.ts`, with table-driven tests.
- [ ] `T7.3-02` - Ports `ExerciseCatalogRepository`, `CustomExerciseRepository` (`hasLoggedSets`), `ExerciseCatalogPort`.
- [ ] `T7.3-03` - `SqliteExerciseCatalogRepository` and `SqliteCustomExerciseRepository`; `tests/exercise-library/test-db.ts` and mothers if 7.2 has not created them; repository tests.
- [ ] `T7.3-04` - `SupabaseExerciseCatalogRepository` and `SupabaseCustomExerciseRepository` (`findRecentIdsForUser` through the joined select of the context readme, deduplicated in code; owner name through the `profiles` join).
- [ ] `T7.3-05` - `ListExercisesUseCase`, `GetRecentExercisesUseCase`, `GetExerciseDetailUseCase`, `ExerciseCatalogAdapter` and their tests.
- [ ] `T7.3-06` - `exercise-library.composition.ts` (`resolveStorageBackend`, `build*` pattern of `workout-tracking.composition.ts`).
- [ ] `T7.3-07` - `list-route-handler.ts`, `src/pages/api/exercises.ts` and `src/pages/api/exercises/[id].ts` with auth and JSON errors; handler tests (ETag, 304, 401, 404).
- [ ] `T7.3-08` - `src/lib/client/exercise-catalog.ts` (`loadExerciseCatalog({ force? })`, module-level promise) and its test.
- [ ] `T7.3-09` - `exercise-list-item.tsx`, `exercise-filters.tsx` and `exercise-library-list.tsx` island.
- [ ] `T7.3-10` - `exercise-picker.tsx` (bottom sheet below 768 px, modal above; `add` and `replace` modes) and its happy-dom tests.
- [ ] `T7.3-11` - Pages `/exercises` and `/exercises/[id]`, `exercise-instructions.astro`, tab handling, placeholders, navigation link.
- [ ] `T7.3-12` - `tests/supabase/exercise-catalog.integration.test.ts` (non-owner reads).
- [ ] `T7.3-13` - Update docs: mark the `ListExercisesUseCase`, `GetRecentExercisesUseCase` and `GetExerciseDetailUseCase` rows `implemented`, fix the tab-placeholder and component-path drift (components.md lists `src/components/exercise-library/exercise-picker.tsx` with `variant` and `multiSelect` props; the context lists flat paths with `mode` and `maxSelectable`), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/exercise-library/exercise-filter.test.ts` | unit, table-driven | Accents and case, AND across / OR within, empty filter, `sortByName`, 50 ms bound (04, 13) |
| `tests/exercise-library/exercise-pickability.test.ts` | unit, table-driven | system / own / own archived / sibling's / missing (12) |
| `tests/exercise-library/picker-selection.test.ts` | unit, table-driven | Order numbers, renumber on deselect, capacity, replace mode (10, 11) |
| `tests/exercise-library/sqlite-exercise-catalog.repository.test.ts` | repo | `listForUser`, archived list, `findById` with owner name, `findByIds`, recent ordering and dedupe (01, 02, 06, 09) |
| `tests/exercise-library/sqlite-custom-exercise.repository.test.ts` | repo | `hasLoggedSets` for entries and for workout exercises (09) |
| `tests/exercise-library/list-exercises.use-case.test.ts` | use-case | Sorted result, `isCustom`, recents (01, 02, 05, 06) |
| `tests/exercise-library/get-exercise-detail.use-case.test.ts` | use-case | `isOwn`, `canEdit`, `isTypeLocked`, not found (08, 09) |
| `tests/exercise-library/exercise-catalog.adapter.test.ts` | use-case | `findUsableByIds`, `findByIds` (12) |
| `tests/exercise-library/list-route-handler.test.ts` | unit | 200, ETag, 304, 401, 404, headers (08, 13) |
| `tests/exercise-library/exercise-picker.test.ts` | component (happy-dom) | Badges, confirm order, replace tap, toast, close (10, 11, 14) |
| `tests/exercise-library/exercise-library-list.test.ts` | component (happy-dom) | Recientes visibility, debounce, filter chips, empty and error states (03, 04, 05, 14) |
| `tests/exercise-library/exercise-catalog-client.test.ts` | unit | Single in-flight request, `force` reload (13) |
| `tests/supabase/exercise-catalog.integration.test.ts` | integration-RLS | Non-owner reads a sibling's custom exercise by id, not in the list; parity with SQLite (15) |

Worked example for `matchesExerciseFilter`:

| Query | Muscles | Equipment | Matches |
|---|---|---|---|
| `press` | — | — | Bench Press, Leg Press, Overhead Press, … |
| `PRÈSS` | — | — | same as above (accent and case) |
| `press` | `chest` | — | Bench Press, Incline Press, Chest Press, … (not Leg Press) |
| — | `chest`, `triceps` | `cable` | Cable Crossover, Tricep Pulldown (OR inside a group, AND across) |
| — | — | — | all rows |

## Out of Scope

- Custom exercise create, edit, archive, restore, *Archivados* link and *+ Crear ejercicio* — story [7.4](./story-7.4.md).
- Real *Récords* tab — story 10.1; real *Gráficas* and *Historial* tabs — story 11.2.
- Hosts of the picker: routine builder — story [8.2](../round-8/story-8.2.md); live workout — story 9.1.
- Offline catalog caching by the service worker — story 12.3.
- Navigation rework and the `/train` entry to the library — stories 9.4 and [8.2](../round-8/story-8.2.md).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
