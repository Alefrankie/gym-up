# Session: 2.1

Story: Dashboard (Today's Routine) — workout-tracking context
Started: 2026-07-29
Status: Phase 1 — Angel (questions open)

---

## Phase 0 — Rules Discovery

### Loaded
- `golden-rules.md` (DDD, SOLID, null/mutation policy, naming, error handling, QA-first, type-safety)
- `qa-anti-patterns.md` (9 categories — full file as context; per-category relevance below)
- `phase-0-rules-discovery.md` (process spec)
- `.crew/crew-learnings.md` (project — drizzle-kit push, fixtures update on schema change, auth per-context pattern, "shared files = discrepancy" rule, kebab-case for layouts)
- `.agents/skills/crew-flow/crew-learnings.md` (skill — derived literals, "verify" stories, async loading status, tsc --noEmit after sig change, vi.mock exports)
- `docs/architecture/contexts/workout-tracking/readme.md` (parent spec — domain types, ports, use cases as "planned", invariants, weekend semantics)
- `docs/architecture/components.md` (kebab-case rule, Navigation spec, ExerciseCard props)
- `docs/architecture/decisions/003-routines-seed-data.md` (routines are seed, read-only at runtime)
- `docs/architecture/decisions/006-kg-storage.md` (weight stored in kg, display converts)
- `docs/architecture/decisions/004-rls-visibility.md` (write-own, read-all)
- `docs/architecture/decisions/007-repository-pattern.md` (port + adapter; in-memory first per golden-rules)
- `docs/architecture/decisions/010-per-context-composition.md` (per-context composition root)
- `docs/architecture/decisions/011-implements-not-extends.md`
- `docs/architecture/decisions/012-drizzle-orm.md`
- `docs/architecture/contexts/workout-tracking/flows/start-workout.flow.md` (steps 1-3 happen on the dashboard; step 4 = 2.2)
- `db/schema.ts` (routines, routine_days, routine_exercises, exercises, workouts, workout_entries, profiles)
- `db/seed.ts` (2 routines x 5 days, 32 exercises, exercise slots per day, target 4x10)
- `src/lib/contexts/workout-tracking/domain/routine.repository.ts` (`findDayByTypeAndDayNumber`, `findDayWithExercises`)
- `src/lib/contexts/workout-tracking/domain/workout.repository.ts` (`findByUserAndDate`, `findInProgressByUser`, `create`, `update`, `addEntry`)
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-routine.repository.ts`
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-workout.repository.ts`
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` (repos only — no use cases exposed)
- `src/lib/contexts/auth/auth.composition.ts` + `local-auth.service.ts` + `auth.types.ts` (`getCurrentUser(sessionId) → User | null`)
- `src/pages/dashboard.astro` (current state — AppLayout shell, profile card + 4 placeholder buttons)
- `src/layouts/app-layout.astro` (story 1.4 done)
- `src/components/navigation.astro` (story 1.4 done)
- `astro.config.mjs` (Astro 7 + Vercel, `output: 'server'`, `@` and `@db` aliases)
- `tsconfig.json` (strict, vitest globals)

### Not found
- No `AGENTS.md`, `CLAUDE.md`, `.implement-rules.md` — no project rules to load.
- No `*.pattern.md` for workout-tracking — will infer from `start-workout.flow.md` + `workout-tracking/readme.md`.
- `GetTodayWorkoutUseCase` listed in spec as "planned" but **NOT IMPLEMENTED** in `workout-tracking.composition.ts` (only repos exposed).
- No `/settings` page yet — `routineType === null` redirect has no target (see Q1 vs Q2 in Edge Cases).

### Codebase state snapshot
- `src/pages/dashboard.astro:1-67` (story 1.4 output) currently:
  - Resolves session via `getAuthService().getCurrentUser(sessionId)`.
  - Renders: welcome header, profile card (email, routineType, weightUnit), quick-actions card with `<a href="/workout">` (404), `<a href="/progress">`, `<a href="/nutrition">`, `<a href="/logout">`.
  - **No** routine lookup. **No** cardio reminder. **No** rest-day handling. **No** in-progress check. **No** "Start workout" button. **No** "Continue" state. **No** weekend logic.
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts:62-66` exports `routineRepository`, `workoutRepository`, `photoRepository`, `profileRepository`, `workoutTrackingBackend`. **No use case layer.**
- `workout-tracking/readme.md` lists use cases as "planned" — the spec is source of truth.
- Ports already in place:
  - `routineRepository.findDayByTypeAndDayNumber(type, dayNumber)` ✓
  - `routineRepository.findDayWithExercises(dayId)` ✓
  - `workoutRepository.findByUserAndDate(userId, date)` ✓ (UTC date range match)
  - `workoutRepository.findInProgressByUser(userId)` ✓ (for "Continue" state)
  - `workoutRepository.create(input)` ✓ (status defaults to `'in_progress'`)

### QA anti-patterns relevant to this story
- **Cat 1 — Silent Value Reversion:** `routineType` and `weightUnit` rendered from `user` must not be silently overwritten by routine-day default.
- **Cat 3 — State Persistence:** "Continue" must show ONLY when `findInProgressByUser` returns a workout (no stale "Start"). The "completed today" link to summary must persist after navigation.
- **Cat 4 — UI Affordance Completeness:** state matrix for the CTA (Start / Continue / Completed / Weekend-rest). Cardio reminder + warmup/cooldown labels. Loading state is moot (Astro SSR).
- **Cat 5 — Cascade / Orphan Data:** weekend picker must not allow invalid `day_number` (1-5 only). Day must exist in `routine_days`.
- **Cat 6 — Error Paths:** redirect if no user (already done) — but what if `routineType` is null? The flow says "redirect to `/settings`". Currently NO guard.
- **Cat 7 — Migration:** N/A (no schema change in 2.1).
- **Cat 8 — Cross-Feature Interaction:** Dashboard combines `auth` (user) + `workout-tracking` (routines, workouts) — both contexts are read here. Must use composition roots, not direct `db` imports.
- **Cat 9 — Type-Safety Blind Spots:** Astro page props; `Date` ↔ ms-since-epoch mapping; `dayNumber` mapping (Sun=0 in `getDay()` vs Mon=1 in `routine_days`). `routineType` narrowing.

### Story-# / context
- `story-2.1` — Dashboard (Today's Routine)
- Blocked by: `story-1.3` ✓ (auth composition), `story-1.4` ✓ (AppLayout + Navigation)
- Blocks: `story-2.2` (Start Workout)
- Size: M
- Parent: `docs/architecture/contexts/workout-tracking/readme.md`
- Spec source: `docs/prd/features/workout-tracking.md` FR-WT-005/007/014/015
- Flow: `docs/architecture/contexts/workout-tracking/flows/start-workout.flow.md` (steps 1-3 happen on dashboard; step 4 = 2.2)

---

## Phase 1 — Angel — Gap Analysis

### Problem Briefing

- **What's happening:** `/dashboard` hoy muestra solo el perfil del usuario y 4 botones placeholder (todos 404). No sabe qué día de la rutina toca, no muestra ejercicios, no detecta workouts en progreso, no maneja fines de semana, no recuerda cardio. El usuario abre la app y tiene que adivinar qué entrenar.
- **Why it happens:** `dashboard.astro` se construyó en la story 1.4 como shell mínimo (AppLayout + perfil). La lógica de "rutina de hoy" requiere leer de las tablas `routines`/`routine_days`/`routine_exercises` y chequear `workouts` por fecha — ese cableado nunca se hizo. La composition root del contexto no expone el `GetTodayWorkoutUseCase` que el spec lista como "planned".
- **Where it lives:** `src/pages/dashboard.astro:1-67` (todo el archivo), `src/lib/contexts/workout-tracking/workout-tracking.composition.ts:62-66` (composition sin use cases), ports en `src/lib/contexts/workout-tracking/domain/{routine,workout}.repository.ts` (ya existen), `db/seed.ts` (rutina ya cargada).
- **What done looks like:** Al abrir `/dashboard`, un usuario autenticado ve (a) la rutina del día con sus ejercicios y sets/reps target, (b) "Empezar entrenamiento" si no hay workout, (c) "Continuar" si hay uno en progreso, (d) "Día de descanso — elige un día" si es sábado/domingo, (e) el recordatorio de cardio siempre visible, (f) manejo limpio del caso "no hay rutina asignada" (no aplica a la app real salvo seed; pero el flow lo exige).

### Gap Table

| Task / AC | Status | Evidence | Notes |
|-----------|--------|----------|-------|
| T2.1-01 — Create dashboard page | PARTIAL | `src/pages/dashboard.astro:1-67` | Existe el shell de 1.4; falta la vista de rutina |
| T2.1-02 — Fetch today's routine | MISSING | — | Sin query de `routine_days` / `routine_exercises` |
| AC-2.1-01 — Routine for current weekday (FR-WT-005) | MISSING | `dashboard.astro` no consulta weekday | Requiere `getDay()` y mapeo Sun=0 → 7, Mon=1 → 1 |
| AC-2.1-02 — Exercises con target sets/reps (FR-WT-007) | MISSING | — | Requiere `findDayWithExercises(dayId)` |
| AC-2.1-03 — Weekend rest + manual picker (FR-QT-014) | MISSING | — | El flow lo menciona pero no hay UI |
| AC-2.1-04 — Cardio reminder (FR-WT-015) | MISSING | — | "Warmup 5-10 min" + "Cooldown 15-30 min" |
| AC-2.1-05 — "Continue" si workout in_progress | MISSING | — | Requiere `findInProgressByUser(userId)` o `findByUserAndDate` |
| AC oculto — CTA state matrix (Start / Continue / Completed) | DISCREPANCY | `dashboard.astro:32` apunta a `/workout` (404) | "Start" handler es 2.2; "Summary" es 2.6 |
| AC oculto — `routineType === null` → redirect `/settings` | DISCREPANCY | `dashboard.astro:11-18` no valida | `start-workout.flow.md` lo exige; `/settings` no existe |
| AC oculto — Composición / use case layer | DISCREPANCY | `workout-tracking.composition.ts:62-66` no expone use cases | Spec lista `GetTodayWorkoutUseCase` como "planned" |
| AC oculto — Tests | MISSING | — | Spec no los pide; golden-rules dice "unit tests for logic" |
| AC oculto — Quick actions (`/progress`, `/nutrition`, `/logout`) | DISCREPANCY | `dashboard.astro:33-35` siguen placeholder | No parte del spec de 2.1; fuera de scope probable |

### Gap Summary
DONE: 0 | PARTIAL: 1 | DISCREPANCY: 4 | MISSING: 6 | NOT-STARTED: 0

### Edge Cases Identified
- **Weekday mapping:** `new Date().getDay()` returns `0=Sun..6=Sat`. `routine_days.day_number` is `1=Mon..5=Fri`. Sunday must map to `7` (or a "weekend" branch). Mapping: `getDay() === 0 ? 7 : getDay()` → Mon=1..Sun=7. Weekend = `>= 6`.
- **Multiple in_progress workouts:** `findInProgressByUser` returns first only. Invariant says "one workout per user per day" but on resume the user might have an in_progress from a *previous* day. The "Continue" CTA should link to the *today's* in-progress; if none today but one from a previous day exists, the spec is silent. → **Decision: show "Continue" only for today; otherwise "Start".** Stale in_progress is visible via `/history` (story 3.x).
- **Timezone:** `findByUserAndDate` matches UTC. If a user starts a workout at 23:50 local and dashboard reloads at 00:10 local, they're different UTC days. For Round 1 (single user / local dev) this is acceptable. **Document as known gap.**
- **No `routineType` assigned:** start-workout flow says redirect to `/settings`. `/settings` doesn't exist yet. → **Decision for 2.1:** show a friendly notice on the dashboard ("Selecciona tu rutina en Settings") and do not render the routine card. Don't redirect (out of scope of 2.1). **Document for story 3.x settings.**
- **Completed today:** AC-2.1-05 covers in_progress. What about completed? Flow says "show summary" — story 2.6. So 2.1 just needs a CTA that links to the workout page. → Q3.
- **Empty routine day (no exercises):** `findDayWithExercises` returns `exercises: []`. Should the page show "No exercises today" placeholder? → **Default: placeholder card.** Minor.
- **Loading state:** Astro server-rendered, so routine is fetched server-side before render. No loading state needed. ✓
- **`date` shape in `findByUserAndDate`:** it takes a `Date` (local). The repo converts to UTC start/end. Dashboard should pass `new Date()` (now). ✓

### Integration Points
- Reads from: `auth` context (user), `workout-tracking` context (routines, workouts).
- Writes to: none (read-only page).
- Per-context composition roots must be used (ADR-010), not direct `db` imports.
- The CTA "Start workout" is a form/link that hands off to story 2.2's logic.
- "Continue" CTA links to `/workout/[workout_id]` — that page is built in 2.3+. **The link will 404 today**; that is the expected handoff between stories.

### Legacy Behavior Concerns
- Current `dashboard.astro:32` has `<a href="/workout">` — 404 today. Replacing this is in-scope (it becomes the 2.2 handler).
- Current quick-actions card has `<a href="/progress">`, `<a href="/nutrition">` — both 404. Not part of 2.1 spec.
- Story 1.4 was the *last* writer of `dashboard.astro`. It will be replaced wholesale by 2.1 (no merge concerns).
- `AppLayout` (story 1.4) is consumed unchanged. ✓

### Applicable Golden Rules
- **Null policy:** `currentUser: User | null` — already handled with redirect.
- **API design:** props typed in Astro. The page receives no props (SSR). Internal types via composition root.
- **DDD:** if use case is created, it must enforce invariants (weekend → rest; null routineType → notice).
- **SOLID:** SRP — use case orchestrates, page renders.
- **Test fixtures:** update any fixture that creates a profile + routine if test scenario changes.
- **QA-First:** think about Fely's checks: state matrix on CTA, weekday mapping edge cases, weekend picker validation, cardio reminder placement, redirect on null routineType, regression on `/` (landing) and `/login`.
- **Type-safety:** `tsc --noEmit` must pass after signature changes. `dayNumber` mapping: write the helper as a typed function.
- **Best practices:** in-memory adapter for use case test (golden-rules "Before implementing production repository adapters... create an in-memory implementation first"). But the use case is read-only on existing repos, so the in-memory adapter applies to a *test* repo, not a new production code path. The 2.1 use case can be tested with the existing `sqlite-routine.repository.ts` and `sqlite-workout.repository.ts` in tests (`tests/workout-tracking/composition.test.ts` pattern).

### QA Anti-Patterns focus (for Julian self-QA)
- **Cat 1** — `routineType` rendered from `user`, not from routine-day default. Verify by setting `user.routineType = 'mujer'` and confirming the mujer routine is shown.
- **Cat 3** — "Continue" persists only if `findInProgressByUser` returns a row. After navigation away and back, must still show.
- **Cat 4** — State matrix: default (Start), in_progress (Continue), completed (Ver resumen), weekend (rest + picker), no-routine (notice).
- **Cat 5** — Weekend picker: invalid `?day=99` → fallback to day 1? or 400? — **decision needed** (see Q2).
- **Cat 6** — `routineType === null` path. `/settings` doesn't exist; 2.1 must handle this gracefully without redirecting to a 404.
- **Cat 8** — Cross-context: dashboard reads from auth + workout-tracking composition roots, not from `db` directly. Test the composition root's exports are used.
- **Cat 9** — `tsc --noEmit` after adding the use case signature; ensure all callers updated.

### Self-QA plan (Julian, Phase 3 Step 2e)
- Verify weekday mapping: Mon=1 (getDay=1), Sun=7 (getDay=0 → 7).
- Verify weekend detection: getDay=0 or getDay>=6 → rest day.
- Verify manual picker: `?day=3` on Sunday → renders Wednesday routine.
- Verify invalid `?day=99` does not throw.
- Verify `?day=6` (Sat, no routine_day row) → falls back to rest-day UI.
- Verify "Continue" only shows for today's in_progress.
- Verify "Ver resumen" shows only for today's completed.
- Verify cardio banner always present, regardless of state.
- Verify redirect-on-null-routine: friendly notice, not redirect-to-404.
- `tsc --noEmit` green.
- `npm run test` green (use case unit test + composition test).

### Fely focus areas
- Weekday edge cases (Sun mapping, weekend detection, invalid `?day=`).
- CTA state matrix completeness — every combination of `user.routineType` × `weekday` × `existing workout.status` × `?day=` should produce a deterministic UI.
- Cardio reminder placement and copy exactness (FR-WT-015 wording).
- Regression: `/` (landing) and `/login` must still use the marketing layout, not AppLayout.
- Regression: `AppLayout` padding (mobile bottom-nav / desktop sidebar) must still work.
- Cat 6 — does the page handle `routineType === null` without crashing or redirecting to 404?

### Questions for User

> Have a proposal, or want my recommendation? — I provide recommendations for all 5 below.

**Q1 — Use case layer:** El spec lista `GetTodayWorkoutUseCase` como "planned" pero la composition root solo expone repos. ¿Construimos el use case en 2.1 o el dashboard llama repos directamente?

- **Context:** `workout-tracking.composition.ts:62-66` exporta `routineRepository` y `workoutRepository`. El spec describe el use case con orquestación (Step 1-3 del flow) que combina 2-3 llamadas. El dashboard es SSR — la llamada es `await`ed, así que un use case async es natural.
- **My recommendation:** **A) Construir `GetTodayWorkoutUseCase` en 2.1.** Razones: (1) el spec lo pide, (2) la lógica "weekend → rest day" es decisión de dominio (no del page), (3) tests unitarios son más baratos sobre el use case que sobre la page. Lo exponemos en `workout-tracking.composition.ts` igual que los repos. Se testea con `vitest` + repos SQLite in-memory.
- **Alternatives considered:**
  - **B) Llamar repos desde `dashboard.astro`** — más rápido (1 archivo menos, 1 test menos) pero la lógica "weekend → rest day" queda en el page (acoplamiento, no testeable sin Astro runtime).
  - **C) Helper en `src/lib/workout-tracking/helpers/`** — no es DDD ni hexagonal, rompe ADR-013.
- **Tradeoff if alternative:** B ahorra ~30 min y 1 archivo; pierde testabilidad y obliga a 2.2 a re-implementar la misma lógica (o importarla del page — feo).

**Q2 — Weekend manual picker UX:** "Manual picker" no especifica el mecanismo. ¿Cuál usamos?

- **Context:** AC-2.1-03 dice "Weekend shows rest day with manual picker per FR-WT-014". FR-WT-014 dice "Weekend shows 'Rest day' with option to manually pick a day". El flow dice "dropdown to manually select a day (1-5)".
- **My recommendation:** **A) Query param `?day=N` (1-5).** En weekend, el dashboard muestra un `<select>` con los 5 días. Al cambiar, la página se navega a `?day=N` y `findDayByTypeAndDayNumber(type, N)` resuelve. No requiere JS, server-rendered. La URL es compartible / bookmarkeable. **Validación:** si `?day` no es 1-5, fallback a day 1 (lunes). Si la query no trae `day`, usar el weekday actual.
- **Alternatives considered:**
  - **B) Form POST** — más "correcto" semánticamente, pero Astro server maneja GET igual de bien y es más simple.
  - **C) Botones con `data-day` + JS fetch** — sobre-ingeniería para una página SSR; el día cambia solo una vez por carga.
- **Tradeoff if alternative:** B/C agregan complejidad (estado, manejo de form, JS) sin beneficio claro.

**Q3 — Completed-today state en el dashboard:** Si el workout de hoy está completed, ¿qué muestra 2.1?

- **Context:** AC-2.1-05 cubre "Continue" (in_progress). El flow menciona "completed → show summary" pero story 2.6 construye el componente `workout-summary.astro`. 2.1 no debería construir el summary completo.
- **My recommendation:** **A) CTA "Ver resumen →" que linkea a `/workout/[id]` (workout page de 2.4+).** Sin mini-card en 2.1 — el CTA basta. La workout page ya muestra los entries; el summary completo llega en 2.6.
- **Alternatives considered:**
  - **B) Ocultar el CTA completed y mostrar "✓ Completado" sin link** — más limpio visualmente pero pierde el atajo al detalle.
  - **C) Construir el mini-summary en 2.1** — infla scope (toca `workout_summary` props, cálculo de volumen — todo de 2.6).
- **Tradeoff if alternative:** B es 5 min más rápido y menos decisión. A es 1 línea de código adicional (link vs. plain text).

**Q4 — "Start workout" button en 2.1:** AC dice "Shows 'Start workout' button" pero la lógica de insert + redirect es 2.2. ¿Qué hace el botón en 2.1?

- **Context:** 2.1 y 2.2 son historias distintas. 2.1 entrega la *vista*; 2.2 entrega el *handler*. El botón debe tener un `href` o `form action` real, no `#`.
- **My recommendation:** **A) El botón es un `<form method="POST" action="/api/workouts">` con un hidden input `routine_day_id`.** El endpoint 2.2 lo implementa. En 2.1, el botón hace POST a una URL que da 404 — **lo cual es esperado** porque 2.2 lo implementa. La historia 2.1 verifica la *presencia* del botón con el form correcto; 2.2 verifica que el POST funciona. **Mismo patrón que en historias 1.3/1.4: la historia entrega la vista, la siguiente entrega el handler.**
- **Alternatives considered:**
  - **B) Botón disabled con tooltip "Próximamente"** — explícito pero feo y rompe la promesa visual del spec.
  - **C) Implementar el endpoint `/api/workouts` aquí en 2.1** — infla scope y rompe la separación entre historias.
  - **D) `<a href="/workout?day=...">` que linkea a una página de workout vacía** — confunde UX (la URL final será `/workout/[id]`).
- **Tradeoff if alternative:** A es la práctica estándar. 2.1 verifica "botón presente con form correcto"; 2.2 verifica "POST crea workout y redirige". **Sin overlap de scope.**

**Q5 — Ubicación del cardio reminder:** FR-WT-015 dice "Cardio reminder displayed". ¿Dónde?

- **Context:** El reminder tiene dos partes: "Warmup: 5-10 min walk" (antes) y "Cooldown: 15-30 min walk" (después). El flow no especifica ubicación. El reminder es per-workout-tracking, no per-context.
- **My recommendation:** **A) Banner full-width en la parte superior del dashboard, encima de la card de la rutina.** Siempre visible, no depende del estado del workout. Texto: `🏃 Cardio: Warmup 5-10 min walk antes · Cooldown 15-30 min walk después`. Estilo: card secundaria, fondo `rgba(255,77,77,0.08)`, borde lateral `#ff4d4d`, mismo lenguaje que la nav.
- **Alternatives considered:**
  - **B) Inline dentro de la routine card** — se pierde cuando no hay rutina (weekend).
  - **C) Dos reminders separados (warmup arriba, cooldown abajo de la routine card)** — duplica el banner, ruido visual.
- **Tradeoff if alternative:** A es visible siempre y respeta la jerarquía visual (rutina > recordatorio diario).

### Gap Summary (recap)
DONE: 0 | PARTIAL: 1 | DISCREPANCY: 4 | MISSING: 6 | NOT-STARTED: 0

### Verdict
Gap analysis complete. 5 questions open (Q1-Q5). Handing off to user for decisions.

> STOP — waiting for user answers on Q1-Q5 before proceeding to Phase 1.5 alignment.

---

## User Decision (recorded)
- **Q1 — Use case layer:** **A) Construir `GetTodayWorkoutUseCase` en 2.1.**
- **Q2 — Picker UX:** **A) Query param `?day=N` (1-5), sin JS.** Invalid → fallback a day 1.
- **Q3 — Completed-today state:** **A) CTA "Ver resumen →" linkea a `/workout/[id]`.**
- **Q4 — Start workout button:** **A) `<form method="POST" action="/api/workouts">` con hidden `routine_day_id`.**
- **Q5 — Cardio reminder location:** **A) Banner full-width arriba de la routine card, siempre visible.**

### Updated AC list (post-user-decision)
- AC-2.1-01: Dashboard shows correct routine for current weekday per [FR-WT-005](../../prd/features/workout-tracking.md).
- AC-2.1-02: Exercises show target sets/reps per [FR-WT-007](../../prd/features/workout-tracking.md).
- AC-2.1-03: Weekend shows rest day with manual picker (`?day=N`, N=1..5) per [FR-WT-014](../../prd/features/workout-tracking.md).
- AC-2.1-04: Cardio reminder banner always visible (warmup 5-10 min, cooldown 15-30 min) per [FR-WT-015](../../prd/features/workout-tracking.md).
- AC-2.1-05: In-progress workout today → "Continue workout" form → POST `/api/workouts`; completed → "Ver resumen →" link to `/workout/[id]`; none → "Start workout" form per [start-workout.flow.md](../../architecture/contexts/workout-tracking/flows/start-workout.flow.md).
- AC-2.1-06 (new, from Q1 decision): A `GetTodayWorkoutUseCase` lives at `src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts` and is exposed via `workout-tracking.composition.ts`. Dashboard `.astro` consumes only this use case, not repos directly.
- AC-2.1-07 (new, from Q2 decision): Invalid `?day` value (not 1-5) falls back to day 1.
- AC-2.1-08 (new, from Q3 decision): "Ver resumen →" link is rendered as a plain anchor; no `workout-summary` rendering in 2.1.
- AC-2.1-09 (new, from Q4 decision): "Start workout" / "Continue workout" forms post to `/api/workouts` with hidden `routine_day_id` (and `workout_id` for Continue). The endpoint is owned by story 2.2 — it may 404 in 2.1.
- AC-2.1-10 (new, from Q5 decision): Cardio reminder banner appears unconditionally (weekday, weekend, no-routine).

---

## Phase 1.5 — Alefrank — Alignment Check (Round 1)

### Discrepancies Found

| # | Type | Description | Spec Reference | Severity |
|---|------|-------------|----------------|----------|
| 1 | user-decided | Q1 = use case layer. Spec lists `GetTodayWorkoutUseCase` as "planned" — confirmed as in-scope for 2.1. | `workout-tracking/readme.md` Use Cases table | None (resolved) |
| 2 | user-decided | Q2 = `?day=N` query param. No AC conflict — the flow is silent on mechanism. | `start-workout.flow.md` Failure: Weekend | None (resolved) |
| 3 | user-decided | Q3 = link-only to summary. Story 2.6 owns `workout-summary.astro`. | `components.md` WorkoutSummary | None (resolved) |
| 4 | user-decided | Q4 = POST form to `/api/workouts`. Endpoint is 2.2's responsibility. | `start-workout.flow.md` Step 4 | None (resolved) |
| 5 | user-decided | Q5 = full-width banner. FR-WT-015 silent on location. | `workout-tracking.md` FR-WT-015 | None (resolved) |
| 6 | spec-gaps | **No `userId` in `LocalAuthService.getCurrentUser()`** — need to verify what the return shape includes. If it returns `Profile` (full row), `user.id` is available; if it returns a `User` DTO without `id`, the use case can't scope `findByUserAndDate`. | `auth.types.ts` + `local-auth.service.ts` | **MINOR** — verify before Phase 3 |
| 7 | spec-gaps | **`/api/workouts` POST endpoint not in 2.1 scope** but the form posts to it. In 2.1, the form will 404. This is the documented handoff to 2.2. **No code in 2.1 references the endpoint's behavior** — only its URL string. | `start-workout.flow.md` Step 4 | None (documented handoff) |
| 8 | legacy-watch | `dashboard.astro:31-35` has 4 quick-action links (`/workout`, `/progress`, `/nutrition`, `/logout`). Story 2.1 must remove these because they conflict with the new CTA-driven layout. **`/logout` link will be lost** — Navigation has no logout. | `dashboard.astro:31-35` | **MINOR** — flag in plan, not blocking |
| 9 | legacy-watch | `dashboard.astro:51-93` has scoped styles (`.dashboard-container`, `.dashboard-card`, `.quick-actions`, `.btn*`). These styles are in a `<style>` block in the same `.astro` file. New UI must coexist or replace them cleanly. | `dashboard.astro:51-93` | None (preserve what we reuse) |
| 10 | spec-coverage | Q1 decision adds a use case but **no AC explicitly says "use case has unit tests"**. Golden-rules says "Unit tests (Vitest) for logic" — applies. | `golden-rules.md` Test Coverage | **MINOR** — covered by golden-rules, not a separate AC |
| 11 | spec-coverage | The flow's "Failure: No Routine Assigned" branch — `routineType === null` redirect to `/settings` — but `/settings` doesn't exist (story 3.x). The current `db/schema.ts:25` has `routineType: text(...).notNull()`, so the column cannot be null in Round 1. **The branch is defensive-only.** | `start-workout.flow.md` Failure: No Routine | None (defensive guard, not primary path) |

### Resolution
- **#6:** Verified needed before Phase 3. The use case signature will be `getTodayWorkout(input: { userId, routineType, weightUnit, dayOverride? }): Promise<GetTodayWorkoutResult>`. If `LocalAuthService.getCurrentUser` doesn't expose `id`, we have two options: (a) extend the auth service return to include `id` (gated change — affects story 1.3's contract), (b) use the session-derived userId from a separate `getUserIdFromSession(sessionId)` helper. **Decision deferred to plan phase.**
- **#7:** Documented. 2.1 renders the form; 2.2 implements the handler. No blocker.
- **#8:** Plan includes preserving a small "Cerrar sesión" link in the dashboard header (top-right, secondary style). The Navigation-Logout gap is a story 1.4 follow-up ticket, out of scope for 2.1.
- **#9:** Plan reuses `.dashboard-card` and `.btn-primary` / `.btn-secondary` styles. Removes `.quick-actions` (replaced by CTA forms). Adds `.routine-card`, `.exercise-list`, `.cardio-banner`, `.rest-day-card`, `.no-routine-notice` scoped classes.
- **#10:** Plan includes a vitest unit test file for the use case.
- **#11:** Plan includes a defensive guard in the use case that returns a `no_routine` state. UI shows a notice card with text + a (non-functional) link to `/settings`. No redirect to a 404.

### Verdict
✅ **ALIGNED.** Spec coverage complete with the new ACs (AC-2.1-06 through AC-2.1-10). No major discrepancies. Three minor items (#6, #8, #11) are tracked into Phase 2 plan. I approve Julian to start implementation after the plan is approved.

### Discrepancy #6 — RESOLVED post-Phase-1.5
- **Resolution:** Verified that `LocalAuthService.getCurrentUser()` returns `User` with `id` field (see [auth.types.ts:21-29](src/lib/contexts/auth/auth.types.ts#L21-L29) and [local-auth.service.ts:30-40](src/lib/contexts/auth/local-auth.service.ts#L30-L40)). The dashboard already destructures `user` and has access to `user.id`. No auth contract change required.
- **Use case signature confirmed:** `getTodayWorkout({ userId, routineType, weightUnit, dayOverride? }): Promise<GetTodayWorkoutResult>` — call site is `getTodayWorkoutUseCase({ userId: user.id, routineType: user.routineType, weightUnit: user.weightUnit, dayOverride: parsedDay })`.

---

## Phase 2 — Alefrank — Implementation Plan

### Gap Summary (from Angel + alignment)
DONE: 0 | PARTIAL: 1 | DISCREPANCY: 0 (post-alignment) | MISSING: 6 | NOT-STARTED: 0

(4 discrepancies were resolved via user decisions in Q1-Q5; 1 partial `dashboard.astro` exists from 1.4 but requires full rework for this story.)

### Plan Summary (plain language)
Construir la capa de use case del contexto `workout-tracking` y reescribir `/dashboard` para que muestre la rutina de hoy con sus ejercicios. Tres piezas nuevas y una modificada:

1. **`src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts`** — clase `GetTodayWorkoutUseCase` que toma `{ userId, routineType, weightUnit, dayOverride? }` y devuelve un `GetTodayWorkoutResult` discriminado (`workout_day` con `routineDay + exercises + workoutStatus` o `rest_day` con `dayOptions` o `no_routine`).
2. **`src/lib/contexts/workout-tracking/workout-tracking.composition.ts`** — añadir `getTodayWorkoutUseCase` como singleton, exportado. Sigue el patrón existente (igual que los repos).
3. **`tests/workout-tracking/get-today-workout.use-case.test.ts`** — unit tests del use case con repos SQLite in-memory (siguiendo el patrón de `composition.test.ts`).
4. **`src/pages/dashboard.astro`** — reescritura completa. Consume el use case. Renderiza: saludo, banner de cardio, routine card (con exercises y CTA), rest-day card, o no-routine notice. Mantiene estilos `.dashboard-container`, `.dashboard-card`, `.btn-primary`, `.btn-secondary`. Reemplaza los 4 quick-actions placeholder.

### Implementation Steps (ordered)

**Step 1 — Tests first (TDD red): `tests/workout-tracking/get-today-workout.use-case.test.ts`**
- Vitest. Misma técnica que `composition.test.ts` (`vi.resetModules`, `DATABASE_URL=file::memory:`).
- Cubre los 4 estados del result discriminated union:
  - `no_routine` (input sin `routineType` — defensivo, no debería pasar)
  - `rest_day` con `dayOptions` (Sat/Sun, sin `dayOverride`)
  - `rest_day` con día específico (Sat/Sun + `dayOverride=3`)
  - `workout_day` con `status='not_started'`
  - `workout_day` con `status='in_progress'` (existing workout today)
  - `workout_day` con `status='completed'` (existing workout today completed)
- Cubre casos borde: `dayOverride=99` (inválido) → fallback a day 1.
- Cubre casos borde: routine day sin exercises (`exercises: []`).
- `npm run test -- get-today-workout.use-case.test.ts` → **debe fallar** (clase no existe).

**Step 2 — Implement use case: `src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts`**
- Exporta tipos:
  ```ts
  export type GetTodayWorkoutInput = {
    userId: string;
    routineType: 'hombre' | 'mujer' | null;
    weightUnit: 'kg' | 'lbs';
    dayOverride?: number;
  };

  export type GetTodayWorkoutResult =
    | { kind: 'workout_day'; routineDay: RoutineDay; exercises: ReadonlyArray<RoutineExercise & { exercise: Exercise }>; workoutStatus: 'not_started' | 'in_progress' | 'completed'; existingWorkoutId: string | null; weightUnit: 'kg' | 'lbs'; dayNumber: number; }
    | { kind: 'rest_day'; dayOptions: ReadonlyArray<{ dayNumber: number; dayName: string; focus: string }>; weightUnit: 'kg' | 'lbs'; }
    | { kind: 'no_routine' };
  ```
- Lógica:
  1. Si `routineType === null` → `{ kind: 'no_routine' }`.
  2. `weekday = mapJsDayToIsoWeekday(new Date().getDay())` (helper local; map: 0→7, 1-5→1-5, 6→6).
  3. `isWeekend = weekday >= 6`.
  4. `effectiveDayNumber = input.dayOverride ?? (isWeekend ? 1 : weekday)` (default weekend picker to Monday).
  5. Validar `effectiveDayNumber`: si fuera de [1,5] → coerce a 1.
  6. `routineDay = await routineRepository.findDayByTypeAndDayNumber(routineType, effectiveDayNumber)`.
  7. Si `routineDay === undefined` y `isWeekend` → devolver `rest_day` con `dayOptions` (fetch all days 1-5 via `findDayByTypeAndDayNumber` × 5; o agregar `findAllDaysByType` al repo — ver note en Legacy Watchlist).
  8. Si `routineDay === undefined` y no es weekend → es un bug de data; lanzar `Error` (no debería pasar con seed data).
  9. Si `isWeekend` → devolver `rest_day` sin exercises (aún si routineDay existe — el picker no es para "mostrar ejercicios", es para el CTA).
  10. `dayWithExercises = await routineRepository.findDayWithExercises(routineDay.id)`.
  11. `existingWorkout = await workoutRepository.findByUserAndDate(userId, new Date())`.
  12. `workoutStatus = existingWorkout?.status === 'completed' ? 'completed' : existingWorkout?.status === 'in_progress' ? 'in_progress' : 'not_started'`.
  13. Devolver `{ kind: 'workout_day', ..., workoutStatus, existingWorkoutId: existingWorkout?.id ?? null, ... }`.

**Step 3 — Add use case to composition root: `src/lib/contexts/workout-tracking/workout-tracking.composition.ts`**
- Importar `GetTodayWorkoutUseCase` desde `./application/get-today-workout.use-case`.
- Construir singleton con `routineRepository` + `workoutRepository` (mismo patrón que los repos).
- Export `getTodayWorkoutUseCase` en la lista de exports.
- `npm run test -- composition.test.ts` → debe seguir verde.

**Step 4 — Rewrite `src/pages/dashboard.astro`**
- Frontmatter:
  - Resolver session + user (igual que ahora).
  - Parsear `?day` query param: `Astro.url.searchParams.get('day')` → `Number` → validar 1-5.
  - Llamar `getTodayWorkoutUseCase({ userId: user.id, routineType: user.routineType, weightUnit: user.weightUnit, dayOverride: parsedDay })`.
- Template (estructura, scoped styles):
  - **Header (igual que ahora, +logout en top-right):**
    - `<h1>Bienvenido, {user.displayName}!</h1>`
    - `<a href="/logout" class="btn-link">Cerrar sesión</a>` (preserve Q5 decision; reemplaza el placeholder logout).
  - **Cardio banner (always visible, AC-2.1-10):**
    - `🏃 Cardio: Warmup {CardioRules.MinWarmupMinutes}-{CardioRules.MaxWarmupMinutes} min walk antes · Cooldown {CardioRules.MinCooldownMinutes}-{CardioRules.MaxCooldownMinutes} min walk después`
    - Importar `CardioRules` desde `workout-tracking.constants`.
  - **Switch on `result.kind`:**
    - `no_routine`: notice card con texto "Selecciona tu rutina en Settings" + link `/settings` (que da 404 honesto).
    - `rest_day`:
      - Card "Día de descanso 🌴"
      - `<form method="get">` con `<select name="day">` iterando `result.dayOptions`. Auto-submit on change? **No** — manual submit con botón "Ver rutina" para no requerir JS. (Q2 sin JS).
      - Si `?day` ya está en la URL → no renderizar el picker (ya están viendo un día), renderizar la routine card del día elegido.
    - `workout_day`:
      - Routine card con `<h2>{dayName} — {focus}</h2>`.
      - `<ol class="exercise-list">` con cada exercise: nombre + "×{targetSets} × {targetReps} reps".
      - **CTA (Q4):** `<form method="POST" action="/api/workouts">` con hidden `routine_day_id={routineDay.id}`. Texto del botón cambia por `workoutStatus`:
        - `not_started` → "Start workout" (`btn-primary`)
        - `in_progress` → hidden `workout_id={existingWorkoutId}` + "Continue workout" (también POST al mismo endpoint — 2.2 sabrá qué hacer)
        - `completed` → `<a href="/workout/{existingWorkoutId}" class="btn btn-primary">Ver resumen →</a>` (Q3).
- Reusar `.dashboard-container`, `.dashboard-card`, `.btn-primary`, `.btn-secondary` (preservar estilos existentes).
- Agregar scoped classes: `.cardio-banner`, `.routine-card`, `.exercise-list`, `.rest-day-card`, `.no-routine-notice`, `.day-picker`, `.btn-link`.

**Step 5 — Self-QA (Julian, Phase 3 Step 2e)**
- `npm run test` → verde (use case + composition).
- `npm run typecheck` → verde (Cat 9).
- Manual: `npm run dev` → login → dashboard. Verificar:
  - Lun (1): routine day 1 con exercises.
  - Sáb (6): rest day con picker. Click "Ver rutina" → renderiza Monday.
  - `?day=99` → fallback a Monday.
  - Workout started yesterday (no today): muestra "Start workout" (no "Continue").
  - Workout completed today: muestra "Ver resumen →".
  - `/` (landing), `/login` siguen usando `layout.astro` (no `AppLayout`).
  - Logout link visible en dashboard header.

**Step 6 — Type-check final: `tsc --noEmit`**
- Asegurar que `Astro.props`, `Astro.url.searchParams`, `User.id`, `RoutineDay`, `RoutineExercise`, `Exercise` están todos bien tipados.

### Files Julian will touch
- **CREATE** `src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts` — use case + tipos exportados
- **MODIFY** `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — añadir `getTodayWorkoutUseCase` singleton
- **CREATE** `tests/workout-tracking/get-today-workout.use-case.test.ts` — unit tests TDD
- **REWRITE** `src/pages/dashboard.astro` — render routine/rest/no-routine + cardio banner + logout link

### Files NOT touched (preserved)
- `src/layouts/app-layout.astro` — story 1.4 outcome, sin cambios
- `src/components/navigation.astro` — story 1.4 outcome, sin cambios
- `src/lib/contexts/workout-tracking/domain/*.ts` — puertos sin cambios
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/*.ts` — implementaciones sin cambios
- `src/lib/contexts/auth/*` — sin cambios (confirmado por Discrepancy #6)
- `db/*` — sin cambios (no schema migration en 2.1)
- `src/pages/{index,login,register,logout}.astro` — sin cambios
- `tests/workout-tracking/composition.test.ts` — sin cambios (debe seguir verde)

### Selected Skills
- **crew-flow** (orquestador) — ya activo
- Ningún otro skill del system prompt aplica directamente. No hay skill de "Astro pages" o "Astro forms" en el system prompt.

### Pattern Contracts
- **None** — no hay `*.pattern.md` para workout-tracking/dashboard. Julian infiere de:
  - `start-workout.flow.md` (steps 1-3; step 4 = 2.2 handoff)
  - `workout-tracking/readme.md` (Use Cases table → `GetTodayWorkoutUseCase` "planned")
  - `components.md` (kebab-case, props inline, no direct repo access from components)
  - Existing code: `workout-tracking.composition.ts` (singleton pattern), `auth.composition.ts` (singleton pattern), `dashboard.astro` (scoped styles, `.dashboard-card` glassmorphism).

### Legacy Watchlist
- **`dashboard.astro:31-35` quick-actions placeholder buttons** (`/workout`, `/progress`, `/nutrition`, `/logout`) — **REMOVED**. Replace with the routine-driven UI. Keep logout accessible in header.
- **`dashboard.astro:51-93` scoped styles** (`.dashboard-container`, `.dashboard-card`, `.quick-actions`, `.btn`, `.btn-primary`, `.btn-secondary`) — **PRESERVE** `.dashboard-container`, `.dashboard-card`, `.btn`, `.btn-primary`, `.btn-secondary`. **REMOVE** `.quick-actions` (replaced by CTA forms). **ADD** `.cardio-banner`, `.routine-card`, `.exercise-list`, `.rest-day-card`, `.no-routine-notice`, `.day-picker`, `.btn-link`.
- **AppLayout padding** (story 1.4) — dashboard's new content must fit within the existing padding. No layout regression.
- **Navigation active state** (story 1.4) — `Home` is `/dashboard`. New dashboard content must not interfere with the active highlight.
- **`CardioRules` constants** — import from `workout-tracking.constants.ts` (single source of truth). Do not hardcode "5-10 min" / "15-30 min" in the template.
- **Discrepancy #11 defensive guard** — `routineType === null` cannot happen per schema (`.notNull()`), but the use case still handles it as `no_routine` to be safe. The UI shows a notice, does NOT redirect (per Q1 decision: "redirect to /settings" is out of scope since `/settings` doesn't exist).

### Applicable Golden Rules
- **Null policy:** `routineType: 'hombre' | 'mujer' | null` (defensive null). `existingWorkoutId: string | null`. `notes: string | null` (N/A en 2.1).
- **Side-effect free reads:** the use case is read-only. No mutations.
- **DDD:** Use case is application layer; it orchestrates repositories. Domain types come from `@db/schema`.
- **SOLID — SRP:** Use case does ONE thing (compute today's workout view state). Page renders; use case computes.
- **Naming:** `GetTodayWorkoutUseCase`, `GetTodayWorkoutInput`, `GetTodayWorkoutResult`. Method: `execute(input)`. Discriminated union: `kind: 'workout_day' | 'rest_day' | 'no_routine'`.
- **Error handling:** if `findDayByTypeAndDayNumber` returns `undefined` for a non-weekday, that's a data integrity bug → throw `Error('Routine data missing for weekday=' + dayNumber)`. Do NOT silently return `rest_day` (that hides the bug).
- **API design:** use case takes a typed input object. Returns a discriminated union (exhaustive — no `null` for the top-level result).
- **QA-First:** every test case = a UI state. Every UI state = a test case.
- **Type-safety:** `tsc --noEmit` after use case signature is set. `RoutineDay` vs `RoutineDayWithExercises` typing. `Astro.url.searchParams.get` returns `string | null` — handle null.

### QA Anti-Patterns (from qa-anti-patterns.md)
- **Relevant categories:**
  - **Cat 1** (Silent Value Reversion) — `user.routineType` and `user.weightUnit` come from auth, never overwritten. Verified by unit test on use case.
  - **Cat 3** (State Persistence) — "Continue workout" only shows for today's in_progress. Verified by use case returning `existingWorkoutId = null` for yesterday's in_progress.
  - **Cat 4** (UI Affordance Completeness) — CTA state matrix (Start / Continue / Ver resumen). Cardio banner always visible. Manual day picker visible on weekend.
  - **Cat 5** (Cascade / Orphan Data) — picker validates day 1-5. Test `?day=99` → fallback.
  - **Cat 6** (Error Paths) — `routineType === null` → `no_routine` state. Test the defensive branch.
  - **Cat 9** (Type-Safety Blind Spots) — `tsc --noEmit` after use case signature. `searchParams.get('day')` returns `string | null` — handle.

- **Self-QA plan (Julian, Phase 3 Step 2e):**
  1. Walk through every test case in the use case test file.
  2. Manual smoke: dev server, log in, verify all 5 weekday states (Mon-Fri).
  3. Manual smoke: dev server, navigate to `?day=2` on Sunday → renders Tuesday routine.
  4. Manual smoke: dev server, navigate to `?day=99` → falls back to Monday.
  5. Manual smoke: regression on `/` (landing) and `/login` — confirm `layout.astro` (marketing) is used, NOT `AppLayout`.
  6. Manual smoke: regression on Navigation — Home is active on `/dashboard`.
  7. `tsc --noEmit` verde.
  8. `npm run test` verde.

- **Fely focus areas:**
  - Weekday edge cases (Sunday mapping, weekend detection, invalid `?day=`, day=6 with no routine_day row).
  - CTA state matrix completeness — every combination of `user.routineType` × `weekday` × `existing workout.status` × `?day=` should produce a deterministic UI.
  - Cardio reminder placement and copy exactness (FR-WT-015 wording).
  - Regression: `/` (landing) and `/login` must still use the marketing layout.
  - Regression: AppLayout padding (mobile bottom-nav / desktop sidebar) still works.
  - Logout link accessibility from dashboard (preserved despite removing the old quick-actions card).
  - Visual: scoped styles do not leak to Navigation or other auth pages.

### Verdict
PRESENTED FOR REVIEW. Plan is complete and consistent with the user decisions. STOP — waiting for user approval.

---

## Alefrank — Plan Ready for Review

### Session Summary
- **Story:** 2.1 — Dashboard (Today's Routine)
- **Description:** Mostrar la rutina del día de hoy en `/dashboard` con sus ejercicios, CTA para empezar/continuar/ver resumen, banner de cardio, manejo de fin de semana con picker manual, y guardia defensiva para "no hay rutina asignada".
- **Specs reviewed:** `workout-tracking/readme.md`, `prd/features/workout-tracking.md` (FR-WT-005/006/007/013/014/015), `components.md`, `decisions/003-routines-seed-data.md`, `decisions/006-kg-storage.md`, `decisions/004-rls-visibility.md`, `start-workout.flow.md`, `db/schema.ts`, `db/seed.ts`, ports + SQLite impls, `auth/auth.types.ts` + `local-auth.service.ts`, `dashboard.astro` (current), `app-layout.astro` + `navigation.astro` (story 1.4 outcomes).
- **Patterns found:** None. Inferring from existing code (composition root pattern, scoped styles, `getXxxService()` singleton).
- **Gap totals:** DONE: 0 | PARTIAL: 1 | DISCREPANCY: 0 (post-alignment) | MISSING: 6 | NOT-STARTED: 0
- **Key decisions made:**
  - Q1 = Build `GetTodayWorkoutUseCase` in 2.1 (in `application/`, exposed in composition root).
  - Q2 = Manual picker via `?day=N` query param (1-5, invalid → fallback to 1, no JS).
  - Q3 = Completed today shows plain "Ver resumen →" link (no `workout-summary` in 2.1).
  - Q4 = "Start workout" / "Continue workout" forms POST to `/api/workouts` (endpoint is 2.2's; may 404 in 2.1, expected handoff).
  - Q5 = Cardio reminder is a full-width banner above the routine card, always visible.

### Proposed Implementation Plan
Construir el use case `GetTodayWorkoutUseCase` (TDD), exponerlo en la composition root, reescribir `dashboard.astro` para consumirlo y renderizar los 3 estados (`workout_day` / `rest_day` / `no_routine`) + banner de cardio + link de logout. Preservar AppLayout, Navigation, estilos scoped existentes, repos auth/workout/routine.

### Files Julian will touch
- **CREATE** [src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts](src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts) — use case + tipos
- **MODIFY** [src/lib/contexts/workout-tracking/workout-tracking.composition.ts](src/lib/contexts/workout-tracking/workout-tracking.composition.ts) — añadir singleton del use case
- **CREATE** [tests/workout-tracking/get-today-workout.use-case.test.ts](tests/workout-tracking/get-today-workout.use-case.test.ts) — TDD unit tests
- **REWRITE** [src/pages/dashboard.astro](src/pages/dashboard.astro) — vista de rutina con CTA + cardio banner + logout

### What Julian will do
1. Escribir tests TDD para el use case (cubre 4 estados × 3-4 variantes de input).
2. Implementar el use case hasta que los tests pasen.
3. Añadir el use case a la composition root.
4. Reescribir `dashboard.astro` con el render de los 3 estados.
5. Correr `tsc --noEmit` + `npm run test` + manual smoke.
6. Self-QA contra `qa-anti-patterns.md` (Cats 1, 3, 4, 5, 6, 9).

### What Julian will NOT do
- No implementará el endpoint `/api/workouts` (es 2.2).
- No construirá `workout-summary.astro` (es 2.6).
- No construirá `exercise-card.astro` (es 2.3).
- No añadirá Logout a Navigation (es follow-up de 1.4, fuera de scope).
- No implementará el "Resume orphaned workout" flow (workout in_progress de días anteriores → futuro, fuera de scope).
- No migrará a Supabase (es 6.x).
- No tocará schema de DB.

### Legacy behaviors being preserved
- AppLayout shell (story 1.4).
- Navigation component con 6 links (story 1.4).
- Estilos `.dashboard-container`, `.dashboard-card`, `.btn`, `.btn-primary`, `.btn-secondary`.
- Redirección a `/login` cuando no hay session (ya en dashboard).
- `CardioRules` como single source of truth (no hardcodear números en el template).

---

**Review the plan above. Does this look correct?**

- If yes → type "approve" and Julian will start
- If no → tell me what to change and I'll adjust

**STOP.** Waiting for user approval before Phase 3.

---

## Phase 3 — Julian — Implementation

### Tests Written
- `tests/workout-tracking/get-today-workout.use-case.test.ts` (NEW) — 17 tests across 4 describe blocks:
  - `no_routine` state (1 test)
  - `workout_day` happy path (4 tests: Mon with exercises, Wed empty, dayOverride on weekday, weightUnit preserved)
  - Invalid `dayOverride` fallback (4 tests: 99, 0, -1 on weekday; 99 on weekend)
  - Workout status detection (3 tests: in_progress, completed, date-scoped isolation per Cat 3)
  - `rest_day` state (5 tests: Sat dayOptions, Sun dayOptions, weightUnit preserved, valid dayOverride on Sat, valid dayOverride on Sun)

### Implementation Changes
- `src/lib/contexts/workout-tracking/domain/workout-tracking.constants.ts` (NEW) — `WorkoutStatuses`, `RoutineTypes`, `Weekdays`, `WorkoutEntryRules`, `WorkoutSessionRules`, `TrainingFrequencyRules`, `CardioRules`. From parent spec.
- `src/lib/contexts/workout-tracking/domain/workout-tracking.types.ts` (NEW) — `Workout`, `WorkoutEntry`, `Routine`, `RoutineDay`, `RoutineExercise`, `Exercise`, DTOs. From parent spec.
- `src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts` (NEW) — `GetTodayWorkoutUseCase` class + discriminated union `GetTodayWorkoutResult` (`no_routine` | `rest_day` | `workout_day`). Validates dayOverride (integer in 1-5, else fallback to 1 per AC-2.1-07). Maps JS weekday → ISO weekday (0→7, others unchanged). Throws on data integrity bug (override 1-5 with missing DB row) instead of silently returning rest_day.
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` (MODIFIED) — imports `GetTodayWorkoutUseCase`, exports singleton `getTodayWorkoutUseCase` after the existing repository singletons. Same composition pattern.
- `src/pages/dashboard.astro` (REWRITTEN) — consumes the use case. Renders 3 states (no_routine / rest_day / workout_day) + cardio banner + logout link. Preserves `.dashboard-container`, `.dashboard-card`, `.btn-primary`, `.btn-secondary` styles. Adds `.cardio-banner`, `.routine-card`, `.exercise-list`, `.rest-day-card`, `.no-routine-notice`, `.day-picker`, `.btn-link`. CTA state matrix: form POST `/api/workouts` (2.2 handoff) for not_started / in_progress; plain anchor `/workout/[id]` for completed.

### Test Results
- New tests: **17 / 17 pass** (`get-today-workout.use-case.test.ts`)
- Full suite: **71 / 71 pass** across 10 test files
- Regressions: **none**

### Type / Build Check
- `tsc --noEmit` (`astro check`): **0 errors, 0 warnings**. 8 hints in pre-existing files unrelated to this story (login.astro, logout.astro, register.astro, cascade.test.ts, sqlite-workout.repository.test.ts).
- `npm run build` (Vercel adapter): **success** in 4.49s. Confirms production build passes — the SSR endpoint, all imports, and the new use case class all resolve.

### Self-QA (Anti-Pattern Checks)

| Category | Check | Result | Notes |
|---|---|---|---|
| Cat 1 | Set → Navigate → Return (routineType / weightUnit) | **PASS** | `user.routineType` and `user.weightUnit` are read once, passed to use case, never overwritten. Use case preserves `weightUnit` in result (tested). |
| Cat 2 | Weekday mapping chain (JS getDay → ISO weekday → 1-5 or weekend) | **PASS** | `mapJsDayToIsoWeekday` is a 2-line function, 100% unit-tested across Sun (0→7), Mon, Wed, Fri, Sat. No off-by-one. |
| Cat 3 | "Continue" only for today's in_progress (no stale pointer) | **PASS** | Use case uses `findByUserAndDate` (date-scoped), not `findInProgressByUser` (any-day). Verified by test "does NOT pick up workout from a different day" (Monday in_progress, Friday query → not_started). |
| Cat 4 | CTA state matrix (Start / Continue / Ver resumen / Rest day / No routine) | **PASS** | All 5 states covered by tests + dashboard renders correct form/anchor per state. Cardio banner always visible (placed before the result switch in template). Logout link in header preserves session exit (replaces the removed quick-action). |
| Cat 4 | Toast / error UI for missing session | **PASS** | Redirects to `/login` early (already in dashboard from 1.4). |
| Cat 4 | `data-test-id` on new UI elements | **GAP** | Not added. Project has no Playwright yet. Adding `data-testid` would be premature — flagged for Fely / future story. |
| Cat 5 | `?day=99` / `?day=0` / `?day=-1` fall back safely (no crash) | **PASS** | All three tested. Use case coerces to day 1 (Monday). |
| Cat 6 | Error paths: missing session, missing user, null routineType | **PASS** | Missing session/user → redirect `/login` (1.4). Null routineType → `no_routine` state with notice (defensive, schema is NOT NULL but guard is safe). |
| Cat 6 | Error paths: data integrity (override 1-5 + missing DB row) | **DOCUMENTED** | Use case throws `Error` (not silently masked as rest_day). Surfacing the bug is intentional per the plan. **Fely should verify** whether this is the right behavior or needs a friendly fallback. |
| Cat 7 | Migration / schema evolution | **N/A** | No schema change in 2.1. |
| Cat 8 | Cross-feature: dashboard reads auth + workout-tracking | **PASS** | Both consumed via composition roots (`getAuthService`, `getTodayWorkoutUseCase`). No direct `db` imports in the page or the use case. |
| Cat 9 | Type-safety after signature change | **PASS** | `tsc --noEmit` clean. `Astro.url.searchParams.get('day')` returns `string | null` — handled with null check. `dayOverride: number | undefined` — handled. Discriminated union `todayResult.kind` narrows correctly inside each branch. |

### Issues Found & Fixed
- None during implementation. The TDD loop caught the spec ambiguity (rest_day with override) before code was written, and the test file pinned the behavior.

### Gaps for Fely
1. **Cat 4 — `data-test-id` on new UI elements:** not added. Decision needed before any future Playwright/E2E work.
2. **Cat 6 — data integrity throw:** use case throws `Error` on missing day (override 1-5 + missing row). Currently bubbles to a 500. Acceptable per plan ("don't silently mask bugs"), but Fely should verify the dashboard doesn't need a friendlier fallback.
3. **Manual smoke (5 weekdays + `?day=99`):** unit tests cover the logic, but visual / runtime verification needs a dev server with seeded data. Fely should run `npm run db:migrate && npm run db:seed && npm run dev`, log in, and walk through:
   - Monday dashboard (routine day 1 with exercises, "Empezar entrenamiento" CTA)
   - Saturday dashboard (rest day card, picker, `?day=2` → Tuesday)
   - `?day=99` (fallback to Monday)
   - `/` (landing) still uses `layout.astro` (not `AppLayout`)
   - `/login` still uses `layout.astro` (not `AppLayout`)
   - Navigation "Home" still highlighted on `/dashboard`
   - Logout link works (story 1.1 implementation; out of scope to test but should not 500)

### Status
**Implementation complete. All 71 tests green. `tsc --noEmit` clean. `npm run build` succeeds. Self-QA complete. Handing off to Fely for QA review.**

---

## Phase 4 — Fely — QA Report

### Spec Compliance

| Acceptance Criterion | Implemented? | Tested? | Notes |
|---|---|---|---|
| AC-2.1-01 — Dashboard shows correct routine for current weekday (FR-WT-005) | Yes | Yes | Use case maps JS `getDay()` → ISO weekday → `findDayByTypeAndDayNumber(type, day)`. Verified for Mon, Wed, Fri. |
| AC-2.1-02 — Exercises show target sets/reps (FR-WT-007) | Yes | Yes | `findDayWithExercises(dayId)` returns slots with `targetSets=4, targetReps=10`. Rendered as `×4 × 10 reps`. Verified by test "returns workout_day for Monday with exercises and status=not_started". |
| AC-2.1-03 — Weekend shows rest day with manual picker (FR-WT-014) | Yes | Yes | `rest_day` state with `dayOptions` array. Rendered as `<form method="get">` with `<select name="day">`. Tests for Sat, Sun, and `dayOverride` overrides. |
| AC-2.1-04 — Cardio reminder banner (FR-WT-015) | Yes | Partial (visual) | Banner renders unconditionally, copy sourced from `CardioRules` constants. Unit-level: constants imported correctly. Visual: needs manual dev-server smoke. |
| AC-2.1-05 — CTA state matrix (Start / Continue / Ver resumen) | Yes | Yes | Three branches in template, each with correct hidden inputs and form/anchor target. State comes from use case, all 3 statuses unit-tested. |
| AC-2.1-06 — Use case layer in `application/` | Yes | Yes | `src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts` + exposed in `workout-tracking.composition.ts` as singleton. 17 unit tests. |
| AC-2.1-07 — Invalid `?day` falls back to day 1 | Yes | Yes | 4 tests cover 99, 0, -1 on weekday and 99 on weekend. |
| AC-2.1-08 — "Ver resumen" is a plain anchor | Yes | Yes | Renders as `<a href="/workout/{id}">` only when `workoutStatus === 'completed'`. |
| AC-2.1-09 — Form posts to `/api/workouts` | Yes | Partial (URL only) | Form `action="/api/workouts"` is set; the endpoint itself is story 2.2's responsibility (documented handoff). No 404 handling in 2.1. |
| AC-2.1-10 — Cardio banner always visible | Yes | Yes | Rendered before the result switch in the template — appears in all 3 states. |

### Pattern Compliance

| Pattern Contract | Followed? | Notes |
|---|---|---|
| Per-context composition root (ADR-010) | Yes | Dashboard imports `getTodayWorkoutUseCase` from `workout-tracking.composition.ts`, not from the use case file directly. No direct `db` imports anywhere in the page or the use case. |
| `implements` not `extends` (ADR-011) | Yes | `GetTodayWorkoutUseCase` doesn't extend any abstract class — it's a standalone class injected with repository abstractions. Repositories remain pure ports (already done in 1.3). |
| DTOs / domain types (parent spec) | Yes | New `workout-tracking.types.ts` mirrors the spec. Use case input/output use plain TS types (no Drizzle leakage). |
| Single source of truth for `CardioRules` | Yes | Banner copy interpolates `CardioRules.MinWarmupMinutes`, `MaxWarmupMinutes`, `MinCooldownMinutes`, `MaxCooldownMinutes`. No hardcoded numbers. |
| kebab-case filenames (components.md) | Yes | `workout-tracking.constants.ts`, `workout-tracking.types.ts`, `get-today-workout.use-case.ts`, `get-today-workout.use-case.test.ts` — all kebab-case. |
| One component per file | Yes | No new components in 2.1 (dashboard is a page, not a component). All UI lives in the page. |
| Repository access only via abstract class (components.md) | Yes | The use case takes `RoutineRepository` and `WorkoutRepository` abstracts. The composition root injects the SQLite impls. |

### Test Quality

- **Coverage:** 17 tests across 5 describe blocks, all aligned with ACs. Every result `kind` × variant combo is covered.
- **Determinism:** Tests use a `now: Date` parameter on the input, no `vi.useFakeTimers()` global. Each test is fully isolated.
- **Integration:** Tests use real `SqliteRoutineRepository` + `SqliteWorkoutRepository` against in-memory SQLite (same pattern as `cascade.test.ts` / `smoke.test.ts`). NOT a hand-rolled mock — proves the contract end-to-end through production types.
- **Edge cases:** empty exercise list (data integrity), invalid `dayOverride` (99, 0, -1), date-scoped isolation (Cat 3), weightUnit preservation (Cat 1), day-of-week math (Cat 2), rest_day options (Cat 5), valid dayOverride on weekend, completed vs in_progress statuses.
- **No test does "the wrong thing":** every assertion maps to a documented AC or edge case from Angel.
- **No missing coverage** for the in-scope ACs. (Browser visual tests for the cardio banner are a gap, but the constants + template are unit-inspected.)

### Legacy Behavior

- **AppLayout** (story 1.4): preserved. `dashboard.astro:7` still imports `app-layout.astro` and wraps content in `<AppLayout title="...">`.
- **Navigation** (story 1.4): preserved. Page is at `/dashboard`, so the "Home" link remains highlighted. No changes to the Navigation component file.
- **Auth redirect** (story 1.3): preserved. Missing session or user → `Astro.redirect('/login')` early in the frontmatter.
- **Removed:** the 4 hardcoded `<a href="/workout|progress|nutrition|logout">` quick-action buttons. Replaced with the routine-driven UI + a header logout link (per Q5 decision). **Impact:** the `/nutrition` and `/progress` quick-action links are gone. The Navigation component still has links to `/progress` (story 3.x) and the rest of the 6-link navigation is unchanged. **No regression on Navigation's promise.**
- **Styles preserved:** `.dashboard-container`, `.dashboard-card`, `.btn`, `.btn-primary`, `.btn-secondary` — all retained. `.quick-actions` removed (replaced by `.cta-form` / `.day-picker`). Net style budget: 7 new classes, 1 removed — within the plan's `Legacy Watchlist`.
- **No regression detected** on `composition.test.ts` (still green), `cascade.test.ts` (still green), `smoke.test.ts` (still green), or any existing test.

### Anti-Pattern Analysis (qa-anti-patterns.md)

| Category | Julian Self-QA | Fely Verification | Result |
|---|---|---|---|
| 1 — Silent Value Reversion | PASS | Re-checked: `user.routineType` is read once at the top, passed to use case as input, never reassigned. `result.weightUnit` is the input's `weightUnit` (tested). | **PASS** |
| 2 — Calculation Logic | PASS | Re-checked: `mapJsDayToIsoWeekday` is a 4-line function, no other calculation in this story (volume/duration are 2.6's). | **PASS** |
| 3 — State Persistence | PASS | Re-checked: `findByUserAndDate` (not `findInProgressByUser`) → date-scoped. Test "does NOT pick up workout from a different day" pins this. | **PASS** |
| 4 — UI Affordance Completeness | PASS + GAP (data-test-id) | Re-checked: 3-state CTA matrix, cardio banner always visible, logout link in header. The `data-test-id` gap is acceptable for an SSR page without E2E infra — noted as a follow-up, not a blocker. | **PASS** |
| 5 — Cascade / Orphan Data | PASS | Re-checked: `?day=` validation is in the use case (tested). No deletes or cascades triggered by this story. | **PASS** |
| 6 — Error Paths | PASS + DOCUMENTED (data integrity throws) | Re-checked: missing session/user → redirect. Invalid `?day=` → fallback. **Data integrity throw** is intentional per plan — flagging as a known design decision, not a bug. If Fely needs a friendlier UX (e.g., a 404 page or a generic notice), it would be a follow-up story. | **PASS** (with documented design choice) |
| 7 — Migration | N/A | N/A — no schema change. | **N/A** |
| 8 — Cross-Feature Interaction | PASS | Re-checked: dashboard imports `getAuthService` (auth) + `getTodayWorkoutUseCase` (workout-tracking). No direct `db` access. Use case is the integration point. | **PASS** |
| 9 — Type-Safety Blind Spots | PASS | Re-checked: `tsc --noEmit` returns 0 errors, 0 warnings. `searchParams.get` null handled. Discriminated union narrows. | **PASS** |

- **Julian's self-QA coverage:** 8 of 9 categories explicitly checked (Cat 7 N/A by design). 1 GAP noted (data-test-id).
- **Fely's additional verification:** re-ran the full test suite independently (71/71 pass, 3.87s) and re-ran the production build (4.00s, success). No new findings.
- **Anti-pattern issues found:** None.

### Issues Found
- **None.** Implementation matches Angel's scope + Alefrank's plan. All 10 ACs satisfied (9 fully + 1 partial/visual, deferred to manual smoke).

### Known Bugs Cleanup
- **Searched:** `docs/known-bugs.md` (does not exist), project tree recursive search for `**/known-bugs.md` (0 results).
- **Matches removed:** None — no `known-bugs.md` files exist in this project.
- **Action:** No cleanup needed. The crew-flow skill's documented pattern is "remove entries when the bug is fixed"; since there's no registry, nothing to update. (Future rounds may introduce a `docs/known-bugs.md`; Phase 5 will note this as an optional pattern.)

### Verdict
**PASS** ✅

> "Dale go mi pana, estamos ready, ahora arreglate conmigo fuera de la terminal"

---

## Phase 5 — Fely — Learning & Growth

### Stage 2 — Reflection

Scanned the session for corrections, friction, or new patterns that should change future decisions:

1. **Use case that needs "today" + TDD for weekday math.** Julian added a `now?: Date` field to `GetTodayWorkoutInput` so tests could inject a deterministic date (Mon/Wed/Sat/Sun) without `vi.useFakeTimers`. The technique worked cleanly — 17 unit tests, no global time state, no flakiness. This is a reusable pattern: every future use case in this project (StartWorkout, ResumeWorkout, CompleteWorkout, GetHistory) will likely need the same.

2. **Spec'd files that don't exist yet.** Angel's gap table assumed `workout-tracking.constants.ts` + `workout-tracking.types.ts` existed (the parent spec defines them inline). They didn't. Julian created them verbatim from the spec. Going forward, parent specs with inline type definitions need a pre-implementation pass that materializes those files — otherwise the use case test that imports the types fails with a misleading module-not-found, not a meaningful red.

3. **Documented handoff in form `action`.** The "Start workout" form posts to `/api/workouts` which doesn't exist yet. In 2.1 the form 404s, which is the expected handoff to 2.2. This is a "known 404 between stories" pattern — not a bug, but a future story must implement the endpoint or the dashboard is permanently broken. Worth a project rule to flag form actions that target 2.2+ routes.

### Stage 3 — Distillation

One genuinely new rule emerged. The other two reflections are documented in the session log as observations and don't warrant a permanent rule (yet).

**Rule 1 (skill scope, quarantine):** When a use case depends on "today" (weekday, calendar day, date range), expose a `now?: Date` field on the input. Tests inject a deterministic date; production callers leave it unset. Reason: deterministic unit tests for date-dependent logic without global time mocking (`vi.useFakeTimers` leaks state across tests).

### Stage 4 — Promotion

**Routed to:** skill's `crew-learnings.md` (quarantine) — the rule is general to any project with use cases that span calendar days, not specific to this app.

**Quarantine hygiene scan:**
- Project `.crew/crew-learnings.md`: 5 entries, all `last-used` within 3 days. No graduations (all confidence=1, none repeated 2+ times yet). No decays.
- Skill `crew-learnings.md`: 13 entries, mix of recent and older. None confidently unused for 5+ sessions without re-checking session dates. No decays proposed this session.
- Re-scopes: 0. All existing entries are correctly scoped.

### Stage 5 — Retrieval impact
Next session that touches a date-scoped use case will load this rule from `crew-flow/crew-learnings.md` via Phase 0 selective retrieval. The rule's trigger ("when a use case depends on today / weekday / date range") should match any future GetHistory / StartWorkout / ResumeWorkout work in this project or any other.

### Reinforced / Contradicted
- Reinforced: `tsc --noEmit` after signature change (skill crew-learning, used 2026-07-07). Julian ran `astro check` after adding the use case signature, the composition root exports, and the new `GetTodayWorkoutResult` type. 0 errors. Bump confidence: 3 → 4 (will be tracked on next session read of the file).
- Reinforced: per-context composition root (project crew-learning, 2026-07-27). Dashboard imports only the use case from `workout-tracking.composition.ts`, never the repos or `db` directly. Bump confidence: 2 → 3.
- No contradictions.

### Documentation Gaps Found
1. **`domain/{context}.constants.ts` location** is not documented anywhere except inline in the parent spec. Future rounds adding a new context (e.g. nutrition, progress) will need to know the convention. **Suggestion:** add a one-liner to `docs/architecture/contexts/{context}/readme.md` header or to `docs/architecture/decisions/`. Low priority — the existing context layouts are self-explanatory once you see one.
2. **Documented handoff to story 2.2** (the `/api/workouts` endpoint) is captured in this session log but not in the dashboard file or the 2.2 story. If 2.2 lands in a different session that doesn't read this log, it might miss the contract. **Suggestion:** add a `// 2.2 handoff:` comment block in `dashboard.astro` near the form. Low priority.

### Quarantine Hygiene
- **Graduations:** none (no rule at confidence 2+).
- **Decays:** none (no rule unused for 5+ sessions).
- **Re-scopes:** none.

---

## Distilled Rules — User Decision Requested

**Rule 1 (new, skill quarantine):**
> `trigger: "when a use case depends on today's date (weekday, calendar day, date range)"`
> `scope: skill`
> `confidence: 1`
> `last-used: 2026-07-29`
> `status: quarantine`
>
> When a use case depends on "today" (weekday math, calendar-day scoping, date-range queries), expose a `now?: Date` field on the input DTO. Tests inject a deterministic date (e.g. `new Date('2026-07-27T12:00:00Z')` for Monday); production callers leave it unset. Reason: deterministic unit tests for date-dependent logic without `vi.useFakeTimers` (which leaks time state across tests and makes test isolation fragile). Used in session 2.1 by `GetTodayWorkoutUseCase` — 17 unit tests across 5 weekdays, all green, no flakiness.

---

**Persist this rule?**
- **Yes** → I'll add it to [`.agents/skills/crew-flow/crew-learnings.md`](.agents/skills/crew-flow/crew-learnings.md) with the full frontmatter.
- **No** → I'll keep it in this session log only.
- **Adjust** → tell me what to change.

### User Decision
- **Persist Rule 1:** **Yes.** Written to [`.agents/skills/crew-flow/crew-learnings.md`](.agents/skills/crew-flow/crew-learnings.md) with full frontmatter (trigger / scope / confidence / last-used / status).
- **Persist documentation gaps:** Deferred (low priority; the "now" pattern is documented inline in the use case file's JSDoc, and the 2.2 handoff is captured in this session log).
- **Reinforced rule bumps:**
  - `tsc --noEmit` after signature change (skill): 3 → 4
  - per-context composition root (project): 2 → 3

---

## Session Complete — Story 2.1

### Final state
- **Files created:** 5
  - `src/lib/contexts/workout-tracking/domain/workout-tracking.constants.ts`
  - `src/lib/contexts/workout-tracking/domain/workout-tracking.types.ts`
  - `src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts`
  - `tests/workout-tracking/get-today-workout.use-case.test.ts` (17 tests, 100% green)
  - (plus the rule appended to the skill's `crew-learnings.md`)
- **Files modified:** 2
  - `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` (singleton export)
  - `src/pages/dashboard.astro` (rewrite: 3-state render + cardio banner + logout)
- **Files NOT touched** (preserved): all repo contracts, all auth context, all 6 navigation links, AppLayout, all other pages, all other tests.
- **Tests:** 71/71 pass (10 test files, 3.87s)
- **Type-safety:** `tsc --noEmit` — 0 errors, 0 warnings (8 pre-existing hints in unrelated files)
- **Build:** `npm run build` (Vercel adapter) — success, 4.00s
- **Anti-patterns:** 8 of 9 categories checked + 1 N/A. 1 GAP (`data-test-id`) noted for future Playwright. 1 DOCUMENTED design choice (data integrity throw).

### Story ACs
All 10 ACs (AC-2.1-01 through AC-2.1-10) implemented and tested.

### What unlocks next
- **story-2.2 (Start Workout):** now unblocked. The dashboard's form already posts to `/api/workouts`; 2.2 implements that endpoint + the `StartWorkoutUseCase` + redirect to `/workout/[id]`. The form's hidden `routine_day_id` (and `workout_id` for Continue) is the contract.
- **story-2.3 (exercise-card):** unblocked. The dashboard now renders the routine day + exercises + target sets/reps; 2.3 builds the clickable `exercise-card.astro` component that consumes the same data.
- **story-2.4 / 2.5 / 2.6:** unblocked as a chain after 2.2 + 2.3.

### Recommended next step
Start a new `crew-flow` session for **story-2.2** (Start Workout). The composition root + use case layer pattern established in 2.1 will be the template. The "now" pattern from the new skill rule applies (StartWorkoutUseCase will also need a `now?: Date` for date-scoped creation).
