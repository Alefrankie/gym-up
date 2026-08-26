# Session: 6.2

## Phase 0 — Rule Discovery

- Loaded: `golden-rules.md`, `phase-0-rules-discovery.md`, `crew-learnings.md` (skill), `qa-anti-patterns.md`.
- Project rules: no `AGENTS.md`/`CLAUDE.md`/`.implement-rules.md` found in root.
- Project learnings: `.crew/crew-learnings.md` — relevant triggers: "before assuming a schema migration is missing" (grep migrations + journal), "Drizzle db.run() parameterized SQL", "Drizzle integer mode timestamp returns Date", "porting SQLite schema with local auth to Supabase seed".
- Pattern files: none for supabase domain — infer from existing code conventions (per-context composition `resolveStorageBackend()`, `implements` not `extends` per ADR-011).
- Specs read: `story-6.2.md`, `story-6.1.md`, `story-6.3.md`, `docs/architecture/database-schema.md`, ADR-004 (RLS write-own/read-all), ADR-005 (private photos), ADR-010 (per-context composition), ADR-007 (repository pattern), ADR-011 (implements-not-extends), ADR-012 (drizzle), context readmes (workout-tracking, private-photos, progress, public-view, nutrition).
- Code read: all abstract ports (ProfileRepository, RoutineRepository, WorkoutRepository, PhotoRepository, ProgressRepository, ExerciseQueryRepository, PublicProfileRepository, PublicWorkoutRepository, NutritionEntryRepository, NutritionGoalRepository), all SqliteXxxRepository impls, all composition roots, `db/schema.ts`, `src/lib/db/client.ts`, `supabase/migrations/001_initial_schema.sql`, `supabase/seed.sql`, `package.json`, `tsconfig.json`, `.env.example`, `tests/workout-tracking/composition.test.ts`.
- Relevant QA anti-pattern categories: 6 (Error Paths — always), 7 (Migration — RLS migration), 9 (Type-Safety — new repo signatures), 5 (Cascade — RLS on FKs).

### Key findings (Phase 0)
1. `@supabase/supabase-js` **NO está instalado** (package.json) — necesario para T6.2-01.
2. La migración `001_initial_schema.sql` **NO tiene tablas de nutrition** (`nutrition_entries`, `nutrition_goals`) ni en `database-schema.md`. Pero AC-6.2-01 exige `SupabaseNutritionEntryRepository` + `SupabaseNutritionGoalRepository`.
3. AC-6.2-01 exige un `SupabaseXxxRepository` para **TODOS** los repos abstractos de Rounds 1–5 (10 repos), pero la lista de tareas solo nombra 4 (Profile, Routine, Workout, Photo). La nota "non-exhaustive" confirma que la lista es parcial.
4. `profiles` en Postgres **no tiene `email`/`password_hash`** (viven en `auth.users`). `ProfileRepository.findByEmail` no puede consultar `public.profiles.email`.
5. Semántica de fechas distinta: Postgres `workout_date`/`photo_date` son `DATE`; SQLite son `timestamp_ms`. Los repos Supabase deben mapear.
6. `@/lib/config` solo existe en docs (ADR-010/readmes); el código real usa `resolveStorageBackend()` por composición. Se seguirá el patrón de código.
7. `.env` local tiene `STORAGE_BACKEND=supabase` (valores truncados según memoria) — tras el wiring, el boot local requerirá credenciales válidas.
8. Tests de integración (T6.2-08/09) requieren acceso real a Supabase (2 usuarios: owner + non-owner) + RLS aplicada al remoto.

---

## Phase 1 — Angel (Gap Analysis & Scope)

### Problem Briefing
La app hoy funciona 100% sobre SQLite local (Rounds 1–5). La story 6.2 es el corazón del Round 6: portar la capa de persistencia a Supabase sin tocar ni un componente ni una página. El contrato (`XxxRepository` abstracto) no cambia; solo cambia el concreto que inyecta la composición según `STORAGE_BACKEND`. Además, la visibilidad (write-own / read-all / owner-only) se baja de la capa de repos a políticas RLS en Postgres.

### Gap Table

| Task | Estado | Notas |
|------|--------|-------|
| T6.2-01 `src/lib/supabase/client.ts` | MISSING | No existe `src/lib/supabase/`. Requiere instalar `@supabase/supabase-js` (no está en package.json). |
| T6.2-02 `SupabaseProfileRepository` | MISSING | `findByEmail` no puede consultar `public.profiles.email` (no existe en Postgres — vive en `auth.users`). Requiere decisión. |
| T6.2-03 `SupabaseRoutineRepository` | MISSING | Read-only; mapeo snake_case→camelCase + DATE. |
| T6.2-04 `SupabaseWorkoutRepository` | MISSING | `workout_date` es DATE en Postgres (no timestamp_ms). Ownership vía RLS, no vía guard en repo. |
| T6.2-05 `SupabasePhotoRepository` (row) | MISSING | Owner-only row; storage en 6.3. |
| T6.2-06 RLS policies | MISSING | `001_initial_schema.sql` ya aplicada al remoto → nueva migración `002_rls_policies.sql`. |
| T6.2-07 Composition roots | MISSING | 4 archivos: workout-tracking, progress, public-view, nutrition. Hoy lanzan error en `supabase`. |
| T6.2-08 Test integración workout | MISSING | Requiere 2 usuarios reales (owner + non-owner) + RLS aplicada. |
| T6.2-09 Test integración photo | MISSING | Ídem. |
| T6.2-10 Regresión sqlite | PARTIAL | `composition.test.ts` existe pero espera que `supabase` lance error — hay que actualizarlo (supabase ya no lanzará). |

### DISCREPANCY — AC-6.2-01 vs lista de tareas
AC-6.2-01 exige un `SupabaseXxxRepository` para **cada** abstracto de Rounds 1–5 = **10 repos**. La lista de tareas solo nombra 4. Los 6 faltantes:
- `SupabaseProgressRepository`, `SupabaseExerciseQueryRepository` (progress)
- `SupabasePublicProfileRepository`, `SupabasePublicWorkoutRepository` (public-view)
- `SupabaseNutritionEntryRepository`, `SupabaseNutritionGoalRepository` (nutrition)

### DISCREPANCY — Tablas de nutrition ausentes en Postgres
`nutrition_entries` y `nutrition_goals` NO existen en `001_initial_schema.sql` ni en `database-schema.md` (stale desde Round 5). Sin ellas, los repos Supabase de nutrition no tienen dónde escribir.

### QA anti-patterns relevantes
Cat. 6 (Error Paths — siempre), Cat. 7 (Migration — RLS), Cat. 9 (Type-Safety — firmas nuevas), Cat. 5 (Cascade — RLS sobre FKs).

---
## User Decision
1. **Alcance AC-6.2-01**: Los 10 repos Supabase (AC completo) — incluye progress, public-view, nutrition.
2. **Tablas nutrition**: Sí — nueva migración `002_nutrition_tables.sql` + RLS en esta story.
3. **findByEmail Supabase**: RPC `SECURITY DEFINER` que consulta `auth.users` por email.
4. **Tests integración**: Gate por env — skip si faltan `SUPABASE_URL`/`SUPABASE_ANON_KEY` válidas.
---

## Phase 1.5 — Alefrank (Alignment Check, Round 1)

### Discrepancies Found
| # | Type | Description | Spec Reference | Severity |
|---|------|-------------|----------------|----------|
| 1 | missing | Story step 3 pide RLS en "storage objects" (owner-only) pero T6.2-05 difiere storage a 6.3. | story-6.2 step 3 vs T6.2-05 | Minor |
| 2 | missing | Las tablas nutrition nuevas (002) necesitan RLS owner-only (ADR-005), no solo DDL. | ADR-005 | Minor |
| 3 | missing | RLS en `workout_entries` write-own debe validar ownership del workout padre (subquery), no solo `auth.uid() = user_id` (no existe user_id en la tabla). | ADR-004 | Minor |
| 4 | missing | El RPC `findByEmail` (decisión del usuario) debe ir en la migración 002 con SECURITY DEFINER + grants. | user decision | Minor |
| 5 | missing | RLS read-all en workouts/profiles NO filtra por usuario → los repos deben seguir filtrando por userId en lecturas user-scoped (`getHistoryByUser`, `findByUser`, `findByUserAndDate`, etc.). | ADR-004 + contratos de repos | Minor |
| 6 | missing | Todos los repos Supabase necesitan mappers snake_case→camelCase + Date (Postgres devuelve DATE/timestamptz como string). | ADR-012 + db/schema.ts | Minor |
| 7 | missing | `.env` local tiene `STORAGE_BACKEND=supabase` con creds truncadas → tras el wiring, el boot local fallará. Flag como follow-up manual (como en 6.1). | .env | Minor |

### Resolution
- [#1] Angel rectifica: se agrega política RLS en `storage.objects` (bucket `progress-photos`) en 6.2; el bucket + `SupabasePhotoStorageAdapter` (upload/signed URL) quedan en 6.3.
- [#2] Angel rectifica: la migración 002 incluye RLS owner-only para `nutrition_entries` y `nutrition_goals`.
- [#3] Angel rectifica: política `workout_entries` usa subquery `EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())`.
- [#4] Angel rectifica: el RPC `get_profile_by_email` (SECURITY DEFINER) se incluye en 002.
- [#5] Angel rectifica: los repos Supabase mantienen filtros por userId en lecturas user-scoped (RLS solo garantiza el piso de seguridad, no el scope de negocio).
- [#6] Angel rectifica: cada repo Supabase incluye un mapper de fila (snake_case→camelCase, DATE→Date).
- [#7] Angel rectifica: se documenta como follow-up manual (no bloquea ACs).

### Verdict
ALIGNED — Angel y Alefrank alineados. Cobertura de spec completa. Sin comportamiento legacy en riesgo. Alefrank aprueba que Julian comience la implementación.
---

## Escalation — Discrepancia mayor AC-6.2-02 (resuelta por el usuario)
AC-6.2-02 decía "non-owner fails to read another user's workout" pero ADR-004 es read-all y la feature familia (public-view) depende de leer workouts ajenos. El usuario decidió: **read-all correcto** — el test verifica que non-owner SÍ lee (read-all) y NO escribe (write-own). Se implementa per ADR-004 + public-view; el literal del AC se corrige en la story.

## User Decision (AC-6.2-02)
- Interpretación: read-all correcto (leer sí, escribir no). Coherente con ADR-004 + public-view.
---

## Phase 2 — Alefrank (Implementation Plan)

### Gap Summary
DONE: 0 | PARTIAL: 1 (T6.2-10) | DISCREPANCY: 2 (AC-6.2-01 scope, nutrition tables) | MISSING: 9 | NOT-STARTED: 0

### Plan Summary
Portar los 10 repos abstractos de Rounds 1–5 a Supabase (mismos contratos, mappers snake_case→camelCase), crear el cliente Supabase, agregar migración 002 (tablas nutrition + RLS + RPC findByEmail), actualizar las 4 composiciones para ramificar por `STORAGE_BACKEND`, y añadir tests de integración RLS con gate por env.

### Implementation Steps
1. Instalar `@supabase/supabase-js`.
2. Crear `src/lib/supabase/client.ts` (init env-driven, error claro si faltan creds).
3. Migración `002_nutrition_and_rls.sql`: tablas `nutrition_entries`/`nutrition_goals` (timestamptz), RLS en las 10 tablas (write-own/read-all per ADR-004; owner-only en progress_photos/nutrition per ADR-005; read-all en routines/exercises), RLS en `storage.objects` (bucket progress-photos), RPC `get_profile_by_email` SECURITY DEFINER.
4. Implementar los 10 `SupabaseXxxRepository` (mappers de fila incluidos).
5. Actualizar las 4 composiciones (workout-tracking, progress, public-view, nutrition) para wirear Supabase.
6. Actualizar `tests/workout-tracking/composition.test.ts` (supabase ya no lanza; T6.2-10).
7. Tests de integración RLS con gate por env (T6.2-08 workout, T6.2-09 photo).
8. Actualizar `docs/architecture/database-schema.md` (tablas nutrition — canonical schema).
9. `tsc --noEmit` + suite completa.

### Selected Skills
- crew-flow (este flujo) — orquesta el trabajo.
- (Sin otras skills relevantes: no hay skill de Supabase/RLS en el workspace.)

### Pattern Contracts
- Ningún `*.pattern.md` para supabase — seguir convenciones de código existentes (ADR-007/010/011/012, `resolveStorageBackend()`, `implements` no `extends`).

### Legacy Watchlist
- `SqliteXxxRepository` intactos (regresión sqlite).
- Puertos abstractos sin cambios de firma.
- `composition.test.ts` — única modificación de test (declarada: supabase ya no lanza error).
- `private-photos.composition.ts` re-exporta `photoRepository` de workout-tracking — no se toca.
- Auth (6.3) fuera de alcance.

### Applicable Golden Rules
- DIP (inyectar, no instanciar), LSP (mismos contratos), Null Policy (find* → undefined), Error Handling (errores claros), Side-Effect Free Reads, Test Fixtures (no editar tests existentes salvo el declarado).

### QA Anti-Patterns
- **Relevantes:** Cat. 6 (Error Paths), Cat. 7 (Migration), Cat. 9 (Type-Safety), Cat. 5 (Cascade/RLS FKs).
- **Self-QA plan:** tsc --noEmit tras firmas nuevas; verificar mappers de fecha; verificar que RLS no rompe lecturas user-scoped; verificar errores claros en client.ts.
- **Fely focus:** verificación manual del boot con `STORAGE_BACKEND=supabase` (creds reales), y confirmación de que la feature familia sigue leyendo workouts ajenos.

### Verdict
PRESENTED FOR REVIEW — Waiting for user approval.
---

## Phase 3 — Julian — Implementation

### Tests Written
- `tests/workout-tracking/composition.test.ts` — actualizado (T6.2-10): supabase ya no lanza; devuelve repos Supabase; error claro si faltan creds. 4/4 PASS.
- `tests/supabase/rls-workout.integration.test.ts` (T6.2-08) — gate por env + `RUN_SUPABASE_INTEGRATION=true`; verifica read-all (leer sí) + write-own (update/delete no).
- `tests/supabase/rls-photo.integration.test.ts` (T6.2-09) — gate por env; verifica owner-only (read/delete no).

### Implementation Changes
- `package.json` — `@supabase/supabase-js@^2.112.4` instalado.
- `src/lib/env.ts` — nuevo: loader `.env` compartido (idempotente).
- `src/lib/supabase/client.ts` — nuevo: cliente Supabase lazy (T6.2-01), error claro si faltan creds.
- `supabase/migrations/002_nutrition_and_rls.sql` — nuevo (T6.2-06): tablas nutrition + RLS en 10 tablas + RLS storage.objects + RPC `get_profile_by_email`. Aplicada al remoto y verificada (2 tablas, 10 RLS, 26 políticas public, 4 storage, RPC).
- 10 repos Supabase nuevos (T6.2-02..05 + AC-6.2-01): Profile, Routine, Workout, Photo (workout-tracking); Progress, ExerciseQuery (progress); PublicProfile, PublicWorkout (public-view); NutritionEntry, NutritionGoal (nutrition).
- 4 composiciones actualizadas (T6.2-07): workout-tracking, progress, public-view, nutrition — ramifican por `STORAGE_BACKEND`.
- `docs/architecture/database-schema.md` — tablas nutrition + sección RLS alineada con 002 + RPC.

### Test Results
- `tsc --noEmit`: PASS.
- `astro build`: PASS.
- Suite completa: 330 passed | 2 failed (PRE-EXISTENTES: nutrition fecha hardcodeada + auth suite ambiental — documentados en 6.1) | 7 skipped (tests integración gateados).
- Regresiones: NINGUNA.

### Self-QA (Anti-Pattern Checks)
| Category | Check | Result | Notes |
|----------|-------|--------|-------|
| 6: Error Paths | Todos los repos lanzan error claro en `error` de Supabase | PASS | Ningún error tragado |
| 6: Error Paths | client.ts lanza error claro si faltan creds | PASS | Test composition lo verifica |
| 7: Migration | 002 aplicada + verificada en remoto | PASS | 2 tablas, 10 RLS, 26+4 políticas, RPC |
| 7: Migration | Idempotencia | PASS | Supabase trackea migraciones |
| 9: Type-Safety | tsc --noEmit tras firmas nuevas | PASS | 0 errores |
| 9: Type-Safety | Blast radius de firmas | PASS | Puertos abstractos intactos |
| 5: Cascade/RLS | workout_entries write-own vía subquery del workout padre | PASS | Verificado en SQL aplicado |

### Issues Found & Fixed
- `storage.objects.owner_id` es TEXT → cast `auth.uid()::text` (migración falló 1 vez, corregida y re-aplicada).
- `WorkoutEntry.createdAt` faltaba en mapper → agregado.
- `NewWorkout.workoutDate` opcional → `?? new Date()`.
- Test "env faltante" recargaba creds reales del `.env` → strings vacíos.

### Gaps for Fely
- `.env` inválido: `SUPABASE_URL` usa `.supabase.com` (typo; debe ser `.supabase.co`) y `SUPABASE_ANON_KEY` da 401. BLOQUEA tests de integración y boot local con `STORAGE_BACKEND=supabase`.
- Tests de integración requieren `RUN_SUPABASE_INTEGRATION=true` + creds válidas + email confirmation desactivado.
- Verificación live de los embedded selects (getHistoryByUser, getLoggedExercises, findDayByTypeAndDayNumber) — requieren conexión válida.
- Usuarios de prueba de integración quedan en auth.users (no hay service_role key para borrarlos).

### Status
Implementation complete. Self-QA complete. Handing off to Fely for QA review.
---

## Follow-up — Env verificado + Grants + RLS end-to-end (2026-08-26)

### .env corregido por el usuario
- `SUPABASE_URL=https://sxbsxnjnikocgsxsdshi.supabase.co` (antes `.com` — typo que no resolvía DNS).
- `SUPABASE_ANON_KEY=sb_publishable_A9DZBxCzthP_uBnxGlmcDw_SNCEEFkA` (nueva key válida — antes daba 401).

### Hallazgo crítico — GRANTs faltantes
Las tablas creadas por migración NO reciben grants DML automáticos en Supabase (solo TRUNCATE/REFERENCES/TRIGGER). Sin SELECT/INSERT/UPDATE/DELETE, las políticas RLS son inútiles (permission denied 42501). Verificado: 0 grants DML para anon/authenticated.
- **Fix:** `supabase/migrations/003_grants.sql` — GRANT DML a `authenticated` en las 10 tablas (anon sin acceso: app privada). Aplicada y verificada (10 SELECT/INSERT/UPDATE/DELETE para authenticated).

### RLS verificado end-to-end (scripts/verify-rls.mjs)
Usuarios de prueba creados vía SQL (evita rate limit de signUp), verificados y limpiados:
- AC-6.2-02 workouts: non-owner SÍ lee (read-all) · NO actualiza · NO borra (write-own) — PASS.
- AC-6.2-03 photos: non-owner NO lee · NO borra (owner-only) — PASS.
- 0 fallos.

### GAP — Tests de integración vitest bloqueados por rate limit
`tests/supabase/rls-*.integration.test.ts` usan `auth.signUp` (crea usuarios únicos por run). Supabase limita signups por hora → "email rate limit exceeded". Los tests están correctos y gateados (`RUN_SUPABASE_INTEGRATION=true` + creds); correrán cuando el rate limit se resetee. Alternativa documentada: `scripts/create-rls-test-users.sql` + `scripts/verify-rls.mjs` (vía SQL, sin rate limit).

### Scripts auxiliares (scripts/)
- `create-rls-test-users.sql` — crea 2 usuarios de prueba en auth.users (vía CLI).
- `verify-rls.mjs` — verifica RLS end-to-end (requiere los usuarios creados).
- `cleanup-rls-test-users.sql` — borra los usuarios de prueba.
- `verify-6.2.sql` — consultas de verificación de migración/grants.
---

## Fase 4 — Fely — QA Report

### Spec Compliance
| Acceptance Criterion | Implemented? | Tested? | Notes |
|---------------------|-------------|---------|-------|
| AC-6.2-01: SupabaseXxxRepository para cada abstracto (10) | Yes | Yes | 10 repos implementados; composiciones los wirean |
| AC-6.2-02: RLS write-own/read-all workouts | Yes | Yes | Verificado end-to-end (verify-rls.mjs + tests integración) |
| AC-6.2-03: RLS owner-only progress_photos | Yes | Yes | Verificado end-to-end |
| AC-6.2-04: Composition root selecciona por STORAGE_BACKEND | Yes | Yes | composition.test.ts (4/4) |
| AC-6.2-05: Switch sqlite↔supabase sin cambios en componentes | Yes | Yes | Solo composiciones cambian; suite sqlite verde |

### Pattern Compliance
| Pattern Contract | Followed? | Notes |
|-----------------|-----------|-------|
| ADR-007 (abstract class + impls) | Yes | `implements`, no `extends` |
| ADR-010 (per-context composition) | Yes | 4 composiciones ramifican |
| ADR-011 (implements-not-extends) | Yes | Todos los repos |
| ADR-012 (drizzle/schema) | Yes | Mappers snake_case→camelCase |
| ADR-004/005 (RLS) | Yes | Políticas aplicadas y verificadas |

### Test Quality
- Tests de integración RLS verifican el comportamiento real (read-all/write-own/owner-only) contra Supabase.
- composition.test.ts verifica el wiring por STORAGE_BACKEND.
- 2 tests pre-existentes corregidos (fixture de fecha + .env DATABASE_URL).

### Legacy Behavior
- SqliteXxxRepository intactos; suite sqlite verde (337 passed).
- Feature familia (read-all) preservada y verificada.
- Sin regresiones.

### Anti-Pattern Analysis
| Category | Julian Self-QA | Fely Verification | Result |
|----------|---------------|-------------------|--------|
| 6: Error Paths | PASS | Repos lanzan errores claros; client.ts valida env | PASS |
| 7: Migration | PASS | 002+003 aplicadas y verificadas en remoto | PASS |
| 9: Type-Safety | PASS | tsc --noEmit 0 errores; build Astro OK | PASS |
| 5: Cascade/RLS | PASS | workout_entries vía subquery del workout padre | PASS |

### Issues Found
1. `.env` DATABASE_URL era `postgresql://...` (rompía el cliente SQLite) → corregido a `file:./local.db`.
2. Test nutrition con fecha hardcodeada fuera de ventana → fixture derivado de `new Date()`.
3. Tests de integración dependían de signUp (rate limit) → ahora usan usuarios SQL fijos (robusto).

### Known Bugs Cleanup
- Buscados: `**/known-bugs.md` → no existen en el proyecto. Nada que limpiar.

### Verdict
**PASS** — Todos los ACs verificados. Suite verde (337 passed, 0 fallos). RLS verificado end-to-end contra Supabase real.

> "Dale go mi pana, estamos ready, ahora arreglate conmigo fuera de la terminal"
---

## Phase 5 — Fely — Session Learnings

### Distilled Rules (persistidas, aprobadas por el usuario)
1. Grants DML necesarios para RLS en Supabase — skill, quarantine, confidence 1.
2. `DATABASE_URL` = SQLite (no Postgres) — project, `.crew/crew-learnings.md`, confidence 1.
3. Tests de integración Supabase: usuarios vía SQL + sign-in, no signUp (rate limit) — skill, quarantine, confidence 1.
4. `storage.objects.owner_id` es TEXT → `auth.uid()::text` — skill, quarantine, confidence 1.

### Reinforced
- Regla de fechas en tests de ventana — confidence 2 → 3 (fallo del test de nutrition con fecha hardcodeada).

### Documentation Gaps
- Necesidad de GRANTs explícitos para RLS no documentada en `docs/` — candidato a `docs/architecture/readme.md`.

### Quarantine Hygiene
- Graduations: ninguna. Decays: ninguna. Re-scopes: ninguna.

---
## User Decision
Learnings aprobados ("ok"). Story 6.2 COMPLETA.
---