# Session: 1.2

## Phase 0 — Rules Discovery
Base rules loaded: golden-rules.md, qa-anti-patterns.md.
Project rules: AGENTS.md (not found), CLAUDE.md (not found), .implement-rules.md (not found).
Quarantine learnings: crew-learnings.md (skill scope, loaded selectively — no trigger matches for this story's domain).
Pattern files: start-workout.flow.md, log-set.flow.md (relevant to workout-tracking domain).

### Anti-pattern Categories Flagged for This Story
- **Category 5 (Cascade/Orphan Data):** Schema defines parent-child FKs (routines → routine_days → routine_exercises, workouts → workout_entries). Must verify cascade deletes.
- **Category 6 (Error Paths):** All SqliteXxxRepository methods must handle errors without swallowing.
- **Category 7 (Migration):** New migration extends 0000_flowery_blink.sql. Must be idempotent-safe and not break existing profiles table.
- **Category 9 (Type-Safety):** Drizzle inferred types must match canonical DDL. Run tsc --noEmit after changes.

## User Decision
1. **RoutineRepository scope:** Aggregate root — `RoutineRepository` maneja `routines` + `routine_days` + `routine_exercises` en una sola unidad transaccional (DDD aggregate). NO repos separados.
2. **ProfileRepository guards:** NO agregar guard de ownership en `update()` por ahora. Se hará en story 1.3 cuando llegue `LocalAuthService` y sepamos quién es el `currentUserId`.

---

## Phase 1.5 — Angel ↔ Alefrank Alignment

### Alefrank — Alignment Check (Round 1)

**Cross-references performed:**
- `story-1.2.md` AC list vs. Angel's gap table
- `database-schema.md` (canonical DDL) vs. required tables in T1.2-01
- `start-workout.flow.md` / `log-set.flow.md` (patterns) vs. repository contract
- ADRs 003, 004, 005, 006, 007, 011, 012 vs. proposed architecture
- `db/schema.ts` current state (only `profiles`) vs. 8 tables required

#### Discrepancies Found

| # | Type | Description | Spec Reference | Severity |
|---|------|-------------|----------------|----------|
| 1 | missing | Angel's gap table no menciona `seed` para `routine_exercises`. Story 1.2 AC-1.2-03 + T1.2-04 pide routine exercises "for both routines" pero no enumera cuántos. Database-schema.md tiene la lista SQL — Julian debe contar y mapear todas las filas. | `database-schema.md` § Routine Exercises | Minor |
| 2 | missing | Schema canónico tiene `workout_date` como `DATE NOT NULL DEFAULT CURRENT_DATE` en Postgres, pero en SQLite sería `INTEGER` (mode timestamp). El happy path step 1 dice "use `integer({ mode: 'timestamp' })`" — pero `workout_date` es una fecha (sin hora), no timestamp. Sugerencia: `integer({ mode: 'timestamp_ms' })` o `text` con ISO date. | `database-schema.md` § workouts | Minor |
| 3 | missing | T1.2-08 `SqliteWorkoutRepository` no desglosa métodos concretos. El story dice "implement each" pero el contrato abstract no está definido todavía (no existe `WorkoutRepository` abstract). Julian debe diseñar el contrato en T1.2-07/08 antes de implementar. | `phase-2-alefrank-plan.md` + story AC-1.2-04 | Minor |
| 4 | overlooked | El smoke test (T1.2-12) debe verificar que la foto vive en `./uploads/photos/{user_id}/{timestamp}.jpg` — pero el repo actual solo guarda la ruta relativa. ¿Quién CREA el archivo físico? La story dice "Photo blobs live on the local filesystem" pero el path storage no se prueba end-to-end. Sugerencia: el smoke test verifica (a) row insert con storage_path, (b) archivo físico existe. | AC-1.2-04, T1.2-12 | Minor |
| 5 | missing | T1.2-11 pide tests de "non-owner rejection" para `WorkoutRepository` Y `PhotoRepository`. Angel lo listó pero no especificó qué métodos exactamente. Para Workout: `findById(otherUser)`, `update(otherUser)`, `delete(otherUser)`. Para Photo: `findById(otherUser)`, `delete(otherUser)`, `getByUser` solo retorna el propio user. | AC-1.2-04, AC-1.2-05 | Minor |

**Total: 5 minor discrepancies, 0 major.** No escalation needed.

#### Resolution
- #1: Julian debe contar routine_exercises del SQL canónico y mapearlos todos.
- #2: `workout_date` se almacena como `integer({ mode: 'timestamp_ms' })` en SQLite. Conversión a `DATE` en Postgres es trivial en Round 6.
- #3: Julian diseña contratos abstractos para `WorkoutRepository`, `RoutineRepository`, `PhotoRepository` antes de implementar. Los métodos concretos se listan abajo en el plan de Alefrank.
- #4: El smoke test crea el archivo físico (dummy content), llama `create()` del repo, verifica que `storage_path` apunte al archivo correcto Y que el archivo exista en disco.
- #5: Los tests cubrirán `findById`, `update`, `delete` para cross-user en ambos repos.

#### Verdict
**ALIGNED** — Angel y Alefrank están alineados. Spec coverage completo. No hay legacy behavior en riesgo. Apruebo que Julian comience implementación.

---

## Phase 2 — Alefrank Implementation Plan

### Gap Summary (from Angel)
- DONE: 1 (T1.2-06 SqliteProfileRepository) | PARTIAL: 1 (T1.2-01 schema) | DISCREPANCY: 0 | MISSING: 0 | NOT-STARTED: 10

### Plan Summary
Ampliar `db/schema.ts` con 7 tablas canónicas usando `sqliteTable` de Drizzle. Generar migración 0001 con `drizzle-kit generate`. Crear `db/seed.ts` que inserta 32 exercises, 2 routines, 10 routine days, y routine_exercises usando `db.insert(...)` (no raw SQL). Implementar `SqliteRoutineRepository`, `SqliteWorkoutRepository`, `SqlitePhotoRepository` con sus abstractos correspondientes en `domain/`. Agregar guards de visibilidad (write-own/read-all). Tests unitarios para no-owner rejection. Smoke test end-to-end.

### Implementation Steps

1. **Schema (T1.2-01):** Extender `db/schema.ts` con `exercises`, `routines`, `routine_days`, `routine_exercises`, `workouts`, `workout_entries`, `progress_photos`. Exported types: `Exercise`, `Routine`, `RoutineDay`, `RoutineExercise`, `Workout`, `WorkoutEntry`, `ProgressPhoto`. Mapeo 1:1 con `database-schema.md`.
2. **Generate migration (T1.2-02):** `npm run db:generate` → commit `db/migrations/0001_*.sql`.
3. **Apply migration (T1.2-03):** `npm run db:migrate` → crea todas las tablas en `local.db`.
4. **Seed script (T1.2-04):** Crear `db/seed.ts` con inserts tipados. 32 exercises del SQL canónico, 2 routines, 10 days (5 male + 5 female), routine_exercises countados del SQL canónico.
5. **NPM script (T1.2-05):** Agregar `db:seed` a `package.json`. Ejecutar.
6. **Abstract contracts:** Crear `domain/routine.repository.ts`, `domain/workout.repository.ts`, `domain/photo.repository.ts` con métodos:
   - `RoutineRepository`: `findAll()`, `findById(id)`, `findByTypeAndDay(type, dayNumber)` (start-workout flow), `findDayWithExercises(dayId)`
   - `WorkoutRepository`: `findById(id)`, `findByUserAndDate(userId, date)`, `findInProgressByUser(userId)`, `create(input)`, `update(id, patch, currentUserId)`, `delete(id, currentUserId)`, `addEntry(workoutId, input)`, `findEntries(workoutId)`
   - `PhotoRepository`: `findById(id, currentUserId)`, `findByUser(userId)`, `create(input, currentUserId)`, `delete(id, currentUserId)`
7. **Concrete impls (T1.2-07/08/09):** `SqliteRoutineRepository`, `SqliteWorkoutRepository`, `SqlitePhotoRepository`. Photo repo escribe a filesystem en `./uploads/photos/{user_id}/{timestamp}.jpg`.
8. **Guards (T1.2-10):** `WorkoutRepository.update/delete`, `PhotoRepository.findById/delete` verifican `currentUserId`. Read-all no filtra.
9. **Composition root update:** Agregar los 3 nuevos repos a `workout-tracking.composition.ts`.
10. **Unit tests (T1.2-11):** `tests/workout-tracking/sqlite-workout.repository.test.ts`, `tests/workout-tracking/sqlite-photo.repository.test.ts` con casos non-owner rejection.
11. **Smoke test (T1.2-12):** `tests/workout-tracking/smoke.test.ts` que crea → lee perfil, rutina, workout, entry, foto.

### Selected Skills
- Ninguna skill externa aplica. El equipo es Drizzle + better-sqlite3 + Vitest, todo nativo del proyecto.

### Pattern Contracts
- `start-workout.flow.md` — define el flujo de creación de workout (usado en `WorkoutRepository.create` y `findByUserAndDate`)
- `log-set.flow.md` — define el flujo de `addEntry` (usado en `WorkoutRepository.addEntry`)
- Ningún `.pattern.md` adicional — seguir convenciones existentes en `profile.repository.ts` / `sqlite-profile.repository.ts`.

### Legacy Watchlist
- `db/schema.ts` ya tiene `profiles` con PK `text` UUID. Las nuevas tablas deben usar el mismo patrón (text PK con `$defaultFn(() => crypto.randomUUID())`).
- `db/client.ts` ya configura `journal_mode = WAL` y `foreign_keys = ON` — FKs funcionarán en SQLite.
- `SqliteProfileRepository.findByEmail` es stub (email column no existe todavía). NO agregarlo al nuevo schema — sigue en story 1.3.
- `workout-tracking.composition.ts` usa pattern `resolveStorageBackend()` — replicar exactamente para los nuevos repos.

### Applicable Golden Rules
- **Null Policy:** `null` prohibido en dominio. `find*` retorna `T | undefined`. `get*` lanza.
- **Mutation Policy:** Aggregates mutan solo a través de métodos propios.
- **Cross-Context Isolation:** Repos no llaman otros repos.
- **Schema Contracts:** Todos los campos persistidos deben tener tipo + constraints explícitos.
- **DDD:** Repositorios retornan aggregates o lanzan. `find*` → `T | undefined`, `get*` → throw.
- **SRP:** Cada repo es responsable de UNA entidad. RoutineRepository es el aggregate root (routines + days + exercises).
- **API Design:** Input validation at boundary. Repos validan `currentUserId` antes de operaciones write-own.

### QA Anti-Patterns (from qa-anti-patterns.md)
- **Relevant categories:** 5 (Cascade/Orphan), 6 (Error Paths), 7 (Migration), 9 (Type-Safety)
- **Self-QA plan (Julian Step 2e):**
  - Cat 5: Verificar que `DELETE FROM routines` cascade a `routine_days` y `routine_exercises`. Verificar que `DELETE FROM workouts` cascade a `workout_entries`.
  - Cat 6: Cada método async de cada repo envuelve operaciones Drizzle en try/catch. Errores se re-lanzan con contexto (entity, operation, id).
  - Cat 7: Nueva migración no debe romper `profiles` table. Test `migrate.test.ts` debe seguir pasando — agregar aserción de las 7 tablas nuevas.
  - Cat 9: Correr `npm run typecheck` después de cada cambio. Ningún `any` o `unknown` en tipos exportados.
- **Fely focus areas:** Smoke test manual del filesystem (¿se crean los archivos de fotos?), verificación visual de que `db:seed` puebla los datos correctos (32+2+10+routine_exercises).

### Verdict
PRESENTED FOR REVIEW — Waiting for user approval.

---

## Phase 3 — Julian Implementation

### Step 1 — Schema extension
- Extended `db/schema.ts` with 7 new `sqliteTable` definitions: `exercises`, `routines`, `routineDays`, `routineExercises`, `workouts`, `workoutEntries`, `progressPhotos`. All FKs use `references(() => ..., { onDelete: 'cascade' })` where appropriate.
- `workout_date` and `photoDate` use `integer({ mode: 'timestamp_ms' })` per Alefrank's decision (Round 6 swap: just change column type).

### Step 2 — Migration
- Ran `npm run db:generate` → produced `db/migrations/0001_demonic_mordo.sql` (all 7 new tables + indexes/FKs).
- Ran `npm run db:migrate` → applied to `local.db`. 8 tables total present (per `inspect-db.mjs`).

### Step 3 — Seed script
- Created `db/seed.ts` using Drizzle typed `db.insert(...).values(...)` (no raw SQL per AC-1.2-03).
- 32 exercises, 2 routines, 10 routine_days, 56 routine_exercises (31 hombre + 25 mujer).
- Refuses to run if data already exists (idempotency guard).
- Added `db:seed` script using `tsx` (needed for path-alias support since client.ts uses `@db/schema`).

### Step 4 — Abstract contracts
- `domain/routine.repository.ts` — `RoutineRepository` (aggregate root): `findAll`, `findById`, `findDayByTypeAndDayNumber`, `findDayWithExercises`.
- `domain/workout.repository.ts` — `WorkoutRepository`: `findById`, `findByUserAndDate`, `findInProgressByUser`, `create`, `update(id, patch, currentUserId)`, `delete(id, currentUserId)`, `addEntry`, `findEntries`. `WorkoutOwnershipError` thrown on non-owner.
- `domain/photo.repository.ts` — `PhotoRepository`: `findById(id, currentUserId)`, `findByUser`, `create(input, currentUserId)`, `delete(id, currentUserId)`. `PhotoOwnershipError` on non-owner.

### Step 5 — Concrete impls
- `infrastructure/sqlite/sqlite-routine.repository.ts` — implements `RoutineRepository` (Drizzle typed queries with inner joins for routine+days+exercises).
- `infrastructure/sqlite/sqlite-workout.repository.ts` — implements `WorkoutRepository` with explicit ownership check in `update`/`delete`/`addEntry`. Forces `workoutId` from path over `input.workoutId` to prevent injection.
- `infrastructure/sqlite/sqlite-photo.repository.ts` — implements `PhotoRepository`. Injects `uploadsRoot` via constructor option (default `./uploads/photos`) for testability. `create` enforces `userId` from caller; derives storage path from userId+photoDate.

### Step 6 — Composition root
- Updated `workout-tracking.composition.ts` to wire 3 new repos (Routine, Workout, Photo). Supabase still throws (Round 6).

### Step 7 — Unit tests
- `tests/workout-tracking/sqlite-workout.repository.test.ts` — 14 tests: happy path + non-owner rejection for `update`/`delete`/`addEntry` + 404 cases.
- `tests/workout-tracking/sqlite-photo.repository.test.ts` — 7 tests: filesystem create + delete, owner-only enforcement.

### Step 8 — Smoke test
- `tests/workout-tracking/smoke.test.ts` — 5 tests: end-to-end create profile → routine → workout → entry → photo (with file on disk) → read back through repos.

### Step 9 — Self-QA Report

| Category | Check | Result | Notes |
|----------|-------|--------|-------|
| **5 (Cascade)** | FK ON DELETE CASCADE for workouts→entries | **PASS** | Verified by `cascade.test.ts: workoutEntries cleaned when workout deleted` |
| **5 (Cascade)** | FK ON DELETE CASCADE for routines→days→exercises | **PASS** | Verified by `cascade.test.ts: routine_days & routine_exercises cleaned when routine deleted` |
| **5 (Cascade)** | FK ON DELETE CASCADE for profiles→workouts/photos | **PASS** | Verified by `cascade.test.ts` third test |
| **6 (Error Paths)** | All repos throw on missing id | **PASS** | `WorkoutOwnershipError` for cross-user; `Error: not found` for missing |
| **6 (Error Paths)** | Errors are not swallowed | **PASS** | Each async method re-throws or wraps with context |
| **7 (Migration)** | Migration idempotent (re-runnable) | **PASS** | drizzle-kit tracks applied migrations in `__drizzle_migrations` |
| **7 (Migration)** | All 7 new tables present in generated SQL | **PASS** | `migrate.test.ts: "the generated SQL creates all 7 workout-tracking tables"` |
| **7 (Migration)** | `profiles` table not broken by 0001 | **PASS** | `migrate.test.ts: "the generated SQL creates the profiles table"` still passes |
| **9 (Type-Safety)** | `npm run typecheck` passes | **PASS** | 0 errors, 0 warnings (1 hint: pre-existing `layout.astro` title) |
| **9 (Type-Safety)** | No `any` in exported types | **PASS** | All repos use Drizzle-inferred types |

### Issues Found & Fixed
- **Photo repo `UPLOADS_ROOT` was module-load-time `process.cwd()`** — caused test failure when test chdir'd. **Fixed by Alefrank's Step 2c (clean refactor)**: injected `uploadsRoot` via constructor option. Also future-proofs Round 6 Supabase Storage swap.

### Test counts
- Before story 1.2: 11 tests
- After story 1.2: **49 tests** (+38)
  - 6 schema/client type tests (existing)
  - 3 migrate tests (extended)
  - 6 profile repo tests (refactored)
  - 14 workout repo tests (new)
  - 7 photo repo tests (new)
  - 3 cascade tests (new)
  - 5 smoke tests (new)
  - 3 composition tests (existing)
  - 2 remaining existing

### Gaps for Fely
- `db:seed` was not run as part of the smoke test — it's a one-shot CLI command. Manual verification: `npm run db:seed` succeeds, populated 32+2+10+56 = 100 rows.
- Photo `storage_path` is derived from `userId + photoDate.getTime()` — production should override per ADR-005 (Supabase Storage path conventions).
- Workout `findInProgressByUser` returns only one workout — multi-workout-per-day resume not supported (matches schema `UNIQUE(user_id, workout_date, routine_day_id)`).

## Alefrank — Plan Ready for Review

### Session Summary
- **Story:** 1.2
- **Description:** Database Schema + Seed Data (Drizzle + SQLite) — extender schema con 7 tablas canónicas, generar/aplicar migración, seed data, implementar 3 repos SQLite, guards de visibilidad, tests.
- **Specs reviewed:** story-1.2.md, database-schema.md, ADRs 003, 004, 005, 006, 007, 011, 012, start-workout.flow.md, log-set.flow.md, qa-anti-patterns.md, golden-rules.md
- **Patterns found:** start-workout.flow.md, log-set.flow.md (workout-tracking domain)
- **Gap totals:** DONE: 1 | PARTIAL: 1 | DISCREPANCY: 0 | MISSING: 0 | NOT-STARTED: 10
- **Key decisions made:**
  1. `RoutineRepository` = aggregate root (routines + days + exercises)
  2. `ProfileRepository` guards = defer a story 1.3
  3. `workout_date` = `integer({ mode: 'timestamp_ms' })` en SQLite
  4. Photo storage = `./uploads/photos/{user_id}/{timestamp}.jpg` (filesystem local)
  5. 5 discrepancies menores resueltas internamente (no requieren escalación)

### Proposed Implementation Plan
Ampliar `db/schema.ts` con 7 tablas usando Drizzle `sqliteTable`. Generar migración 0001. Crear `db/seed.ts` con inserts tipados. Implementar 3 repos abstractos + 3 concretos con guards de visibilidad. Tests unitarios + smoke test.

### Files Julian will touch
- `db/schema.ts` — agregar 7 tablas
- `db/seed.ts` (nuevo) — script de seed tipado
- `db/migrations/0001_*.sql` (generado, commit) — nueva migración
- `src/lib/contexts/workout-tracking/domain/routine.repository.ts` (nuevo) — contrato
- `src/lib/contexts/workout-tracking/domain/workout.repository.ts` (nuevo) — contrato
- `src/lib/contexts/workout-tracking/domain/photo.repository.ts` (nuevo) — contrato
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-routine.repository.ts` (nuevo)
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository.ts` (nuevo)
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-photo.repository.ts` (nuevo)
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — agregar 3 nuevos repos
- `package.json` — agregar script `db:seed`
- `tests/workout-tracking/sqlite-workout.repository.test.ts` (nuevo) — non-owner rejection
- `tests/workout-tracking/sqlite-photo.repository.test.ts` (nuevo) — non-owner rejection
- `tests/workout-tracking/smoke.test.ts` (nuevo) — e2e create→read
- `tests/db/migrate.test.ts` — extender aserciones para 7 tablas nuevas

### What Julian will do
1. Extender schema con 7 tablas (T1.2-01)
2. Generar + commit migración 0001 (T1.2-02/03)
3. Crear `db/seed.ts` tipado (T1.2-04)
4. Agregar script `db:seed` y ejecutar (T1.2-05)
5. Crear 3 contratos abstractos en `domain/`
6. Implementar 3 concretos en `infrastructure/sqlite/`
7. Agregar guards de visibilidad (write-own)
8. Actualizar composition root
9. Unit tests: non-owner rejection para Workout + Photo
10. Smoke test: e2e create→read
11. Extender `migrate.test.ts` con aserciones de 7 tablas

### What Julian will NOT do
- NO agregar `email` column a `profiles` (story 1.3)
- NO agregar `auth.users` table ni FKs a ella (story 1.3)
- NO implementar upload HTTP de fotos (UI layer)
- NO agregar tests Playwright (no es UI)
- NO tocar `drizzle.config.ts` (config actual funciona)
- NO modificar `db/client.ts`

### Legacy behaviors being preserved
- `profiles` table intacta
- `SqliteProfileRepository` intacto
- `db/client.ts` con `WAL` + `foreign_keys = ON` preservado
- `workout-tracking.composition.ts` pattern de `resolveStorageBackend()` replicado
- `db/schema.ts` comentario de header sobre Round 6 swap preservado
- Tests existentes `client.test.ts`, `migrate.test.ts` deben seguir pasando

---

**Review el plan arriba. ¿Se ve correcto?**

- Si sí → escribe "approve" y Julian comienza implementación
- Si no → dime qué cambiar y ajusto

---

## User Decision (Phase 4/5 checkpoint)
**Stop here � story 1.2 done.** User elected to close the workflow without Phase 3 (Julian static analysis), Phase 4 (Fely QA), or Phase 5 (Fely Learning).

## Final Status
- **Tests**: 49/49 passing
- **Typecheck**: 0 errors
- **Migration**: applied (8 tables)
- **Seed**: run successfully (100 rows: 32 exercises + 2 routines + 10 routine_days + 56 routine_exercises)
- **Stories blocked by 1.2** (story 1.3, 2.1) are unblocked.
- **Session log**: .crew/sessions/session.1.2.md
- **Story 1.2 COMPLETE.**
