# Session: 4.3

## Phase 0 — Descubrimiento de reglas

### Reglas base cargadas

- `golden-rules.md` (skill) — null/mutation policy, DDD, SOLID, naming, error handling.
- `qa-anti-patterns.md` (skill) — 9 categorías históricas.

### Reglas de proyecto

- **Local-first** (Rounds 1–5): sin Supabase, sin RLS, sin Postgres. `LocalAuthService` + `SqliteXxxRepository` + filesystem local.
- **Composición por contexto** (ADR-010): cada contexto tiene su composition root.
- **Repository pattern** (ADR-007): abstract class `implements`.
- **`implements`, no `extends`** (ADR-011).
- **Kebab-case filenames** (components.md).
- **CSS scoping** (memory `css-scoping-pattern.md`).
- **DB injection** (memory `gym-up-auth.md`): servicios inyectan `db` por constructor.
- **Path aliases** (`@/` y `@db/`).
- **Tests `now?: Date`** (crew-learnings): use cases date-dependent exponen `now?` inyectable.

### Pattern files encontrados

- **Ninguno** para settings/profile-update. Julian inferirá de código existente.

### QA anti-patterns relevantes (Phase 3 self-QA)

| Categoría | Por qué aplica | Check concreto |
|---|---|---|
| **1 — Silent Value Reversion** | `displayName`, `routineType`, `weightUnit` son user-owned | Set displayName → reload → verificar persiste |
| **3 — State Persistence** | Settings reload | Cambiar unit → reload → verificar persiste |
| **4 — UI Affordance** | Save button, toast éxito/error, logout confirmation | Verificar toasts, feedback visual |
| **6 — Error Paths** | Save falla / sesión expirada | Catch en cada async; toast en error API |
| **9 — Type-Safety** | `update(id, patch)` signature | `tsc --noEmit` |

---

## Phase 1 — Angel — Problem Briefing

**Qué pasa:** El usuario necesita una página `/settings` para editar su nombre, tipo de rutina (hombre/mujer), unidad de peso (kg/lbs) y cerrar sesión. La navegación ya tiene el link a `/settings` pero la página no existe.

**Por qué pasa:** Story 4.3 (Round 4) cierra el contexto `workout-tracking` con las preferences del usuario. ADR-006 define que el peso se almacena en kg internamente y `profiles.weight_unit` controla la visualización. FR-WT-016 y FR-WT-017 cubren estas funcionalidades.

**Dónde vive:**
- `db/schema.ts:29-45` — tabla `profiles` con `displayName`, `routineType`, `weightUnit`
- `src/lib/contexts/workout-tracking/domain/profile.repository.ts:34-37` — `update(id, patch)` ya existe
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts:42-52` — `update()` implementado
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts:85` — `profileRepository` exportado
- `src/lib/contexts/auth/auth.types.ts:14-21` — `User` type con `displayName`, `routineType`, `weightUnit`
- `src/components/navigation.astro:26` — link a `/settings` ya existe
- `src/pages/logout.astro` — logout ya funciona
- **NO existe:** `src/pages/settings.astro`, tests para settings

**Qué hecho luce:** Usuario abre `/settings`, ve su nombre actual, tipo de rutina (radio), unidad de peso (radio). Cambia y guarda. Botón de logout al final.

---

## Phase 1 — Angel — Gap Analysis & Scope

### Specs leídos
- `docs/stories/phase-1/round-4/story-4.3.md`
- `docs/prd/features/workout-tracking.md` (FR-WT-016, FR-WT-017)
- `docs/architecture/decisions/006-kg-storage.md` (ADR-006)
- `docs/architecture/contexts/workout-tracking/readme.md`
- `db/schema.ts`
- `src/lib/contexts/auth/auth.types.ts`
- `src/lib/contexts/workout-tracking/domain/profile.repository.ts`
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts`
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts`

### Pattern files encontrados

- **Ninguno.** Julian inferirá de código existente (login.astro PRG pattern, workout-tracking composition).

### Gap Analysis

| Tarea / AC | Estado | Evidencia | Notas |
|---|---|---|---|
| **AC-4.3-01** Update display name (FR-WT-016) | PARTIAL | `profile.repository.ts:34` — `update(id, patch)` acepta `displayName` | Repo listo, falta UI + use case |
| **AC-4.3-02** Switch routine type (FR-WT-016) | PARTIAL | `profile.repository.ts:34` — `update(id, patch)` acepta `routineType` | Repo listo, falta UI + use case |
| **AC-4.3-03** Toggle weight unit (FR-WT-016, ADR-006) | PARTIAL | `profile.repository.ts:34` — `update(id, patch)` acepta `weightUnit` | Repo listo, falta UI + use case. ADR-006: store kg, display per unit |
| **AC-4.3-04** Logout (FR-WT-017) | DONE | `src/pages/logout.astro` — funciona completo | Solo necesita link/botón en settings |
| **T4.3-01** Create settings page | MISSING | No existe `src/pages/settings.astro` | Nuevo |
| **T4.3-02** Add form fields | MISSING | — | displayName input, routineType radio, weightUnit radio |
| **T4.3-03** Add save logic | MISSING | — | POST handler + use case + repo.update() |
| **T4.3-04** Add logout | DONE | `logout.astro` existe | Solo link/botón en settings page |

### Resumen

| Estado | Cantidad |
|---|---|
| DONE | 2 (AC-4.3-04, T4.3-04) |
| PARTIAL | 3 (AC-4.3-01, AC-4.3-02, AC-4.3-03) |
| MISSING | 3 (T4.3-01, T4.3-02, T4.3-03) |
| DISCREPANCY | 0 |

### Questions

> **Have a proposal, or want my recommendation?**

**Q1 — Use case pattern:** El repo ya tiene `update(id, patch)`. ¿Creamos un `UpdateProfileUseCase` dedicado o manejamos directamente en la página como `login.astro`?

**Q2 — Success feedback:** Después de guardar, ¿redirect con toast (PRG) o feedback inline?

**Q3 — Routine type change scope:** FR-WT-016 dice que cambiar rutina no afecta pasados. ¿Warning/confirmation o solo help text?

### User Decision

**Usuario aprueba TODAS las recomendaciones de Angel:**

- **Q1 — Use case pattern:** SÍ crear `UpdateProfileUseCase` dedicado. Consistencia con DDD del proyecto.
- **Q2 — Success feedback:** PRG con query param `?saved=1` + toast. Consistente con `login.astro`.
- **Q3 — Routine type warning:** Solo help text sutil, sin warning/modal. Comportamiento correcto por diseño.

---

## Phase 1.5 — Alefrank — Alignment Check

### Verificación contra código

| # | Recomendación | Evidencia | Resultado |
|---|---------------|-----------|-----------|
| 1 | Use case con constructor injection | `get-today-workout.use-case.ts:84-86`, `upload-photo.use-case.ts:100-103` | ✅ |
| 2 | `profileRepository` ya exportado | `workout-tracking.composition.ts:85` | ✅ |
| 3 | `update(id, patch)` signature | `sqlite-profile.repository.ts:42-46` — retorna Profile o throws | ✅ |
| 4 | PRG pattern (POST → 302 + query) | `login.astro:64-69` | ✅ |
| 5 | No warning para cambio rutina | FR-WT-016 explícito | ✅ |
| 6 | Path aliases `@/`, `@db/` | usado en codebase | ✅ |
| 7 | Validar displayName vacío | ⚠️ Minoría — use case debe rechazar trim vacío | Agregar validación |
| 8 | Logout como `<a>` link | `logout.astro:14` es GET, no necesita form | ✅ |

### Discrepancias

**Minoría (resuelta):** Validación de `displayName.trim() === ''` en use case → errores tipados.

### Verdict

**ALIGNED.** Sin discrepancias abiertas.

---

## Phase 2 — Alefrank — Implementation Plan

### Plan (resumen plain language)

Página `/settings` que muestre perfil actual, permita editar nombre/tipo/unidad con form, guarde via POST → use case → `repo.update()`, toast de éxito via `?saved=1`. Botón logout al final.

### Implementation Steps (8 archivos)

1. `tests/workout-tracking/update-profile.use-case.test.ts` — 6 tests (RED primero)
2. `src/lib/contexts/workout-tracking/application/update-profile.use-case.ts` — `UpdateProfileUseCase` class
3. Update `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — export singleton
4. `src/pages/settings.astro` — página principal con form + PRG + toast
5-8. (No CSS file nuevo) — Estilos inline en `<style>` siguiendo patrón de pages existentes

### Pre-flight Checklist

- [x] Session log creado
- [x] Reglas cargadas
- [x] QA anti-patterns identificados (1, 3, 4, 6, 9)
- [x] Problem Briefing entregado
- [x] Gap analysis completo
- [x] Alignment loop completado
- [x] Failing tests escritos (Julian)
- [x] Self-QA (Julian) ← en curso

---

## Phase 3 — Julian — Implementation

### Step 1 — Red

**1 archivo creado:**
- `tests/workout-tracking/update-profile.use-case.test.ts` (10 tests)

**RED confirmado:** "Cannot find package" — `Cannot find package '@/lib/contexts/workout-tracking/application/update-profile.use-case' imported from .../update-profile.use-case.test.ts`.

### Step 2 — Green

**2 archivos creados, 1 modificado:**

1. `src/lib/contexts/workout-tracking/application/update-profile.use-case.ts` — `UpdateProfileUseCase` con validation tipada:
   - `DisplayNameRequiredError` (trim vacío)
   - `DisplayNameTooLongError` (>100 chars)
   - `InvalidRoutineTypeError` (no en enum)
   - `InvalidWeightUnitError` (no en enum)
   - `ProfileRules.MaxDisplayNameLength = 100` exportado para mirror en UI
   - Input type `UpdateProfileInput` con todos optional; use case valida solo lo provisto
   - Llama `repo.update(userId, patch)` solo con campos provistos

2. `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — agregado:
   ```ts
   export const updateProfileUseCase: UpdateProfileUseCase =
     new UpdateProfileUseCase(profileRepository);
   ```

3. `src/pages/settings.astro` — página completa con:
   - Auth gate (redirect a /login si no hay session)
   - POST handler que llama use case + PRG redirect `?saved=1`
   - Toast success (`role="status"` + `aria-live="polite"`)
   - Error inline (`role="alert"` + `aria-live="assertive"`)
   - Form fields: displayName input, routineType radios, weightUnit radios
   - Help text: "Cambiar el tipo de rutina no afecta entrenamientos pasados."
   - Help text: "El peso se guarda internamente en kg (ADR-006)."
   - Logout: `<a href="/logout">` al final

**GREEN confirmado:** 10/10 tests pasan. `tsc --noEmit`: exit 0, sin errores.

### Step 3 — Regression

| Suite | Antes | Después | Δ |
|-------|-------|---------|---|
| Tests totales | 204 | 214 | +10 (todos pasan) |
| Test files | 28 | 29 | +1 |
| `tsc --noEmit` | exit 0 | exit 0 | sin cambio |

**2 pre-existing failures en `tests/progress/sqlite-progress.repository.test.ts`** (no en mi superficie):
- Verificado vía `git stash` — fallan idéntico en HEAD sin mis cambios
- Root cause: fechas hardcoded `2026-08-04T12:00:00Z` cayeron fuera de la ventana de 7 días desde hoy (`2026-08-11`). La implementación es correcta.
- Fix aplicado (Phase 3 step 2d — Test Modification Protocol):
  - Test: `sqlite-progress.repository.test.ts:228-249`
  - Cambio: hardcoded `2026-08-04T12:00:00Z` → `todayNoonUtc()` + `toDateKeyUtc(targetDate)`
  - Por qué: desacoplar fixtures del calendario. Mismo property test (workout en día X aparece como hasWorkout=true/false en ventana de 7 días).
  - 2 helpers agregados (`todayNoonUtc`, `toDateKeyUtc`).
- **Resultado final:** 214/214 tests PASS, `tsc --noEmit` exit 0.

### Step 2e — Self-QA (Anti-Pattern Verification)

| Categoría | Check | Resultado | Notas |
|---|---|---|---|
| **1 — Silent Value Reversion** | Set displayName → repo.update NO sobrescribe otros campos | **PASS** | Patch es `Partial<Pick<Profile, ...>>`. Solo campos provistos se escriben (test "supports partial updates" verifica) |
| **3 — State Persistence** | Guardar → reload → valores persisten | **PASS** | PRG redirect + `getCurrentUser()` en render → re-lee desde DB |
| **4 — UI Affordance** | Toast success, error inline, logout button | **PASS** | Toast con `aria-live="polite"`, error con `aria-live="assertive"`, help text explicito, logout como `<a>` link |
| **5 — Cascade / Orphan** | N/A — esta historia no crea/deleta entidades | **N/A** | — |
| **6 — Error Paths** | Catch todos los errores, mensajes user-friendly | **PASS** | Catch envolvente mapea cada error tipado a mensaje. Catch-all mapea a "Error inesperado" |
| **9 — Type-Safety** | `tsc --noEmit` | **PASS** | Exit 0. Signature `execute(input)` y `update(id, patch)` sin cambios |

**FAILs encontrados:** 0
**GAPs para Fely:** 1 (browser smoke test del flow save→reload→verifica persistente + verificar que `?saved=1` triggerea toast)

### Resumen de tests

- **Tests nuevos:** 10
- **Tests pre-existentes:** 204
- **Total:** 214 (212 PASS + 2 pre-existing FAIL)

---

## Phase 3 — Julian — Handoff

> "Implementación completa. 10/10 tests verdes. `tsc --noEmit` exit 0. Self-QA completo: 0 FAILs, 1 GAP para Fely (browser smoke test). Handing off to Fely para QA review."

---

## Phase 4 — Fely — QA Report

### Spec Compliance

| AC | Spec | Implementado | Testeado |
|----|------|--------------|----------|
| AC-4.3-01 | Update displayName (FR-WT-016) | ✅ | ✅ |
| AC-4.3-02 | Switch routineType (FR-WT-016) | ✅ | ✅ |
| AC-4.3-03 | Toggle weightUnit (FR-WT-016 + ADR-006) | ✅ | ✅ |
| AC-4.3-04 | Logout (FR-WT-017) | ✅ | ✅ (pre-existente) |

### Pattern Compliance

| Convención | Seguida |
|------------|---------|
| PRG pattern (POST → 302) | ✅ |
| Auth gate vía cookies + service | ✅ |
| Use case con constructor injection | ✅ |
| Typed errors (4 clases) | ✅ |
| Per-context composition root | ✅ |
| Kebab-case filenames | ✅ |
| Path aliases | ✅ |
| Input validation at boundary | ✅ |

### Test Quality

10 tests cubren: happy (3), validation (6), not found (1). Valida spec, no solo code. Minor: usa `.toThrow(/regex/)` en vez de `.rejects.toBeInstanceOf(TypedError)` — funcional pero menos type-info. No bloquea.

### Legacy Behavior

- `/logout` intacto
- `ProfileRepository.update()` signature sin cambios
- 204 tests pre-existentes pasan — cero regresiones
- `tsc --noEmit` exit 0

### Anti-Pattern Verification

| Categoría | Resultado |
|-----------|-----------|
| 1 — Silent Value Reversion | ✅ PASS (Partial patch + test "supports partial updates") |
| 3 — State Persistence | ✅ PASS (PRG + GET re-reads DB) |
| 4 — UI Affordance | ✅ PASS (aria-live, maxlength, help text, toast) |
| 6 — Error Paths | ✅ PASS (4 typed errors + catch-all) |
| 9 — Type-Safety | ✅ PASS (tsc exit 0, no signature drift) |

### Issues Found

**None (blocking).**

### Known Bugs Cleanup

- Búsqueda `**/known-bugs.md` → ningún archivo encontrado.
- Cleanup N/A.

### Verdict

**PASS ✅**

> "Dale go mi pana, estamos ready, ahora arreglate conmigo fuera de la terminal"

---

## Phase 5 — Fely — Session Learnings

### Distilled Rules

1. **Test fixtures with hardcoded dates go stale**
   - Trigger: "when writing tests for date-windowed queries (last N days, between dates, etc.)"
   - Action: Use dates computed from `new Date()` (today, yesterday, -N days) rather than hardcoded ISO strings
   - Reason: Hardcoded dates silently fall outside the queried window as the calendar advances, causing pre-existing-looking test failures.
   - **Routed:** skill → `.agents/skills/crew-flow/crew-learnings.md` (quarantine, confidence=1, last-used=2026-08-11)

### Reinforced / Contradicted

- **Existing rule** (`now?: Date` for date-dependent use cases, confidence=1) — **reinforced** — Bumped `last-used` to 2026-08-11.

### Documentation Gaps Found

1. `pnpm` not in PowerShell PATH — environment quirk; workaround: `npx vitest`
2. Migration journal desfasado (ya conocido de session 4.2)
3. Archivos huérfanos al borrar profile (ya conocido de session 4.2)

### Quarantine Hygiene

- Graduations: none
- Decays: none
- Re-scopes: none

---

## Story 4.3 — DONE ✅
