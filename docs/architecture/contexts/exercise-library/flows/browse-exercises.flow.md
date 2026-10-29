# Browse Exercises Flow

Parent: [../readme.md](../readme.md) · PRD: [../../../../prd/features/exercise-library.md](../../../../prd/features/exercise-library.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Phase | 2 |
| Last edited | 2026-10-01 |
| Requirements | FR-EL-001, FR-EL-002, FR-EL-003, FR-EL-004, FR-EL-009, FR-EL-011, NFR-EL-01 |
| Stories | [7.3](../../../../stories/phase-2/round-7/story-7.3.md) (tabs: [10.1](../../../../stories/phase-2/round-10/story-10.1.md), [11.2](../../../../stories/phase-2/round-11/story-11.2.md)) |

## Happy Path

### Step 1 - Open the library

User taps *Biblioteca de ejercicios* on `/train` (or navigates to `/exercises`). The page renders SSR (auth guard → `/login` without session) with an empty list skeleton and mounts the `exercise-library-list` island.

### Step 2 - Load the catalog

The island calls `loadExerciseCatalog()` → `GET /api/exercises` → `ListExercisesUseCase`. The response is `{ exercises, recentIds }`: every system exercise plus the user's own non-archived custom exercises, sorted by name (`sortByName`). The service worker serves the cached copy first and revalidates in the background (ADR-025); the server answers 304 when the `ETag` matches.

### Step 3 - Recientes and the alphabetical list

With no search and no filters, the island shows:

1. **Recientes** — up to 8 exercises from `recentIds`, in that order (FR-EL-004).
2. **Todos** — the full list, alphabetical, grouped by first letter.

Each row (`ExerciseListItem`) shows the English name, `MuscleGroupLabels[muscleGroup]` and `EquipmentLabels[equipment]` in Spanish, and a "Personalizado" tag when `isCustom` (FR-EL-001, FR-EL-011).

### Step 4 - Search

User types in "Buscar ejercicio". After 150 ms without typing, the island filters in memory with `matchesExerciseFilter` (case- and accent-insensitive substring on the name, FR-EL-002). Recientes is hidden while a query or a filter is active. Decision: Hevy shows recents only on the unfiltered list.

### Step 5 - Filters

User opens "Músculo" and/or "Equipo" and ticks values. Within a group values are OR'ed; across groups they are AND'ed. Active filters show as removable chips plus *Limpiar*. Filtering stays under 50 ms per keystroke (NFR-EL-01).

### Step 6 - Open the detail

User taps a row → `/exercises/[id]` (SSR) → `GetExerciseDetailUseCase`. The header shows name, primary muscle, equipment and the "Personalizado" tag. Tab **Cómo hacerlo** (default, `?tab=como`): primary and secondary muscles, equipment, `ExerciseTypeLabels[exerciseType]`, numbered instructions, and *Ver video* when `videoUrl` is set (opens in a new tab).

### Step 7 - Other tabs

**Historial**, **Gráficas** and **Récords** are SSR tabs (`?tab=historial|graficas|records`) whose data comes from progress-context use cases for the viewer's own sessions ([FR-PR-011..013](../../../../prd/features/progress.md#fr-pr-011)). They are rendered only once stories 10.1 (Récords) and 11.2 (Gráficas, Historial) ship.

---

## Failure: Catalog request fails

`GET /api/exercises` fails and there is no cached copy. The island shows "No se pudo cargar la biblioteca" with *Reintentar*. With a cached copy, the cached list is shown and the failure is silent.

## Failure: Unknown exercise id

`/exercises/[id]` with an id that does not exist → `ExerciseNotFoundError` → 404 page "Ejercicio no encontrado" with a link back to `/exercises`.

## Edge Case: No results

Search and filters match nothing. The island shows "No se encontraron ejercicios" and *Crear «{query}»*, which opens `/exercises/new?name={query}` ([create-custom-exercise flow](./create-custom-exercise.flow.md)). Decision: Hevy offers creating a custom exercise from an empty search.

## Edge Case: New user without history

`recentIds` is empty, so the Recientes section is not rendered.

## Edge Case: Offline

Per ADR-025 the library is one of the cached pages. Offline, the cached catalog is filtered normally; *+ Crear ejercicio* is disabled with "Necesitas conexión para crear ejercicios". Decision: custom exercise creation is not an outbox command in ADR-025.

## Edge Case: A family member's custom exercise

The user reaches `/exercises/[id]` of a sibling's custom exercise from the feed or a member profile (FR-EL-009). The page renders read-only with "Creado por {ownerDisplayName}". There are no *Editar*/*Archivar* actions, and the exercise never appears in the user's own list or picker. The progress tabs show the viewer's own data, which is empty.

## Edge Case: Archived custom exercises

Archived own exercises are not in the list. *Archivados* (`/exercises?archived=1`) lists them with *Restaurar*. Their detail page still opens from history links, with a "Archivado" badge.

## Edge Case: Ambiguous legacy names

`Row`, `Chest Press`, `Incline Press`, `Calves` and `Leg Curl` keep their Phase 1 names. The instructions name the actual variant ([database-schema.md → Exercise Library Seed](../../../database-schema.md#exercise-library-seed)).
