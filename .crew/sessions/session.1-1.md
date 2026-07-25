# Session: 1-1

## Phase 0 — Rule Discovery

### Reglas cargadas (precedencia: pattern files > project rules > crew learnings > golden rules)

1. `golden-rules.md` (skill) — base: null policy, mutation policy, cross-context isolation, side-effect-free reads, schema contracts, test fixtures, DDD, SOLID, naming, error handling, API design, best practices, QA-first thinking.
2. `qa-anti-patterns.md` (skill) — 9 categorías históricas de fallos en QA/UAT. Cargado completo como contexto.
3. **Reglas de proyecto:** no existen `AGENTS.md`, `CLAUDE.md` ni `.implement-rules.md` en raíz (verificado: el proyecto solo tiene `docs/`, `.agents/`, `.crew/`, `.git/`).
4. **Crew learnings (cuarentena):** no existe `.crew/crew-learnings.md` ni `crew-learnings.md` en el skill todavía. Vacío.
5. **Pattern files:** no existen `*.pattern.md` específicos para scaffold/Astro/Drizzle. Julian inferirá desde el código que él mismo va a crear + las ADRs ya aceptadas.
6. **Specs relevantes leídos:**
   - `docs/stories/phase-1/round-1/story-1.1.md` (la historia a ejecutar)
   - `docs/stories/phase-1/readme.md` (rondas, regla "no Supabase hasta Round 6")
   - `docs/architecture/decisions/007-repository-pattern.md` (ADR-007)
   - `docs/architecture/decisions/010-per-context-composition.md` (ADR-010)
   - `docs/architecture/decisions/011-implements-not-extends.md` (ADR-011, referenciada por 007)
   - `docs/architecture/decisions/012-drizzle-orm.md` (ADR-012)
   - `docs/architecture/components.md` (convención kebab-case, navegación)
   - `docs/architecture/contexts/workout-tracking/readme.md` (dominio, entidades, value objects, invariantes)
   - `docs/architecture/database-schema.md` (DDL canónico Postgres → fuente de verdad para columnas)
   - `docs/prd/features/workout-tracking.md` (FR-WT-001…017, требы)

### Anti-patterns relevantes para esta historia (marcados para Phase 3 self-QA)

| Categoría | Aplica | Por qué |
|-----------|--------|---------|
| 1 — Silent Value Reversion | NO | No hay campos editables por usuario en un scaffold. |
| 2 — Calculation/Measure Logic | NO | No hay cálculos. |
| 3 — State Persistence | NO | No hay navegación con estado. |
| 4 — UI Affordance Completeness | NO | Solo landing page estática. |
| 5 — Cascade/Orphan Data | **SÍ** | El schema de `profiles` (FK a `auth.users`) **no es portable 1:1 a SQLite** porque SQLite no tiene `auth.users`. Julian debe documentar la desviación o ajustar el schema. |
| 6 — Error Path Completeness | **SÍ** | El `db/client.ts` debe manejar `DATABASE_URL` ausente / DB no inicializada / errores de migración. **Cat. 6 siempre aplica** por regla del skill. |
| 7 — Migration / Data Model Evolution | **SÍ** | `drizzle-kit generate` debe producir SQL revisable; la historia exige que el SQL se versione en `db/migrations/`. Esta categoría aplica porque Round 6 va a migrar el schema a Postgres. |
| 8 — Cross-Feature Interaction | NO | No hay features que combinar todavía. |
| 9 — Type-Safety Blind Spots | **SÍ** | Story exige inferencia de tipos Drizzle end-to-end; Julian debe correr `astro check` o `tsc --noEmit` (no solo Vitest) antes de cerrar AC-1.1-04 y AC-1.1-08. |

**Categorías activas para self-QA de Phase 3:** 5, 6, 7, 9.

### Desviación detectada durante la lectura de specs (DISCREPANCY potencial)

- **Story 1.1** define el schema inicial con `sqliteTable('profiles', …)`. La spec canónica de `database-schema.md` define `profiles` con `id UUID PRIMARY KEY REFERENCES auth.users(id)`. **En SQLite no existe `auth.users`** (es un esquema de Supabase/Postgres). Esto **no es un bug del scaffold** — es esperado: la regla "No Supabase hasta Round 6" implica que en Round 1 se modela `profiles` como tabla autónoma (con `id UUID PRIMARY KEY` sin FK), y la FK a `auth.users` se añadirá cuando se importe el schema en Round 6.
- **Decisión que debe confirmar el usuario:** ¿el `profiles` de Round 1 debe tener `id` autogenerado o esperar a `id` desde el registro? Mi propuesta: `text('id').primaryKey()` por ahora (UUID generado en app layer al registrar), para que el swap a Postgres solo requiera cambiar `text` por `uuid` y añadir la FK a `auth.users(id)`. **Esto es una pregunta para el usuario** (pregunta Q1 abajo).

---

## Phase 1 — Angel — Gap Analysis & Scope

### Angel — Problem Briefing

**Qué pasa:** La historia 1.1 pide montar el esqueleto del proyecto (Astro + Drizzle + SQLite + Vercel) y dejarlo listo para que las historias 1.2 (schema completo + seed), 1.3 (auth local) y 1.4 (layout/nav) puedan construirse encima. Hoy el repo solo tiene `docs/`, `.agents/`, `.crew/` y `.git/`. No hay `package.json`, ni `astro.config.*`, ni `db/`, ni `src/`. Es **greenfield** total: todo lo que toca el scaffold es código nuevo.

**Por qué importa:** Sin el scaffold, ninguna otra historia de Round 1 puede arrancar. Cualquier error aquí (schema no portable a Postgres, composición central en vez de per-context, nombres en PascalCase, cliente DB instanciado por request) se propaga a las 5 historias siguientes y a Round 6.

**Dónde vive:** nuevos archivos en raíz (`package.json`, `drizzle.config.ts`, `astro.config.*`, `tsconfig.json`, `.env.example`, `.env`), `db/schema.ts`, `db/migrations/`, `src/lib/db/client.ts`, `src/lib/repositories/` (abstracts), `src/lib/repositories/sqlite/` (concreto), `src/lib/composition/workout.ts`, `src/layouts/layout.astro`, `src/pages/index.astro`.

**Qué significa "hecho":** `npm run dev` arranca Astro, `npm run db:migrate` crea `local.db` con la tabla `profiles`, el autocompletado de tipos Drizzle fluye desde `db/schema.ts` hasta la composición, y la landing page renderiza en `/`.

---

### Specs leídas

- `docs/stories/phase-1/round-1/story-1.1.md` (fuente primaria)
- `docs/stories/phase-1/readme.md` (reglas de fase y de ronda)
- `docs/architecture/decisions/007-repository-pattern.md`
- `docs/architecture/decisions/010-per-context-composition.md`
- `docs/architecture/decisions/011-implements-not-extends.md` (referenciada)
- `docs/architecture/decisions/012-drizzle-orm.md`
- `docs/architecture/components.md`
- `docs/architecture/contexts/workout-tracking/readme.md`
- `docs/architecture/database-schema.md`
- `docs/prd/features/workout-tracking.md`

### Patterns encontrados

- **`.pattern.md` específico de scaffold:** no existe. Julian inferirá de las ADRs + la spec de la historia + convenciones de la codebase (que está vacía, así que se sembrará con la convención kebab-case de `components.md`).
- **Convención aplicable:** kebab-case para todos los filenames (`src/lib/repositories/profile.repository.ts`, `src/lib/repositories/sqlite/sqlite-profile.repository.ts`, `src/lib/composition/workout.ts`).
- **Decisión de layout:** la spec dice `src/lib/repositories/` para los abstract, `src/lib/repositories/sqlite/` o similar para el concreto (no está explícito en la historia, pero la ADR-007 distingue abstracts vs concretos). Pregunta Q3.

### Gap analysis

| Task / AC | Estado | Evidencia | Notas |
|---|---|---|---|
| T1.1-01 Crear proyecto Astro + adapter Vercel | MISSING | no existe `package.json` | nuevo |
| T1.1-02 Instalar `drizzle-orm`, `drizzle-kit`, `better-sqlite3`, `@types/better-sqlite3` | MISSING | — | nuevo |
| T1.1-03 `.env` y `.env.example` con `DATABASE_URL=file:./local.db` | MISSING | — | nuevo |
| T1.1-04 `drizzle.config.ts` (dialect: `sqlite`) | MISSING | — | nuevo |
| T1.1-05 `db/schema.ts` con al menos un `sqliteTable` (`profiles`) | MISSING | — | nuevo; ver DISCREPANCY-1 abajo |
| T1.1-06 `src/lib/db/client.ts` con instancia tipada de Drizzle | MISSING | — | nuevo |
| T1.1-07 Abstract `XxxRepository` en `src/lib/repositories/` (ADR-007) | MISSING | — | nuevo; alcance mínimo: `ProfileRepository` (única entidad cuyo scaffold requiere la historia) |
| T1.1-08 Primera `SqliteXxxRepository` concreta (ej. `SqliteProfileRepository`) | MISSING | — | nuevo |
| T1.1-09 Composition root per-context (ADR-010) seleccionando por `STORAGE_BACKEND` | MISSING | — | nuevo; pregunta Q2 (qué contexto) |
| T1.1-10 Scripts npm: `db:generate`, `db:migrate`, `db:studio` | MISSING | — | nuevo |
| T1.1-11 `src/layouts/layout.astro` y `src/pages/index.astro` | MISSING | — | nuevo |
| T1.1-12 Verificar `npm run dev` y `db:migrate` | MISSING | — | nuevo; gate de AC |
| AC-1.1-01 `npm run dev` arranca | MISSING | — | gate |
| AC-1.1-02 `drizzle-kit generate` produce SQL versionado en `db/migrations/` | MISSING | — | gate |
| AC-1.1-03 `drizzle-kit migrate` crea `profiles` en `local.db` | MISSING | — | gate |
| AC-1.1-04 `db` tipado, autocomplete downstream | MISSING | — | gate (self-QA cat. 9) |
| AC-1.1-05 Abstract `XxxRepository` definidos | MISSING | — | gate |
| AC-1.1-06 Al menos un `SqliteXxxRepository` concreto + composition | MISSING | — | gate |
| AC-1.1-07 Landing renderiza en `/` | MISSING | — | gate |
| AC-1.1-08 `db/schema.ts` reusable en Round 6 | MISSING | — | gate (cat. 7) |

### DISCREPANCY-1 (la única detectada)

**Asunto:** `db/schema.ts` debe definir `profiles`, pero la spec canónica `database-schema.md` lo define con `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` (Postgres + `auth.users` de Supabase). SQLite no tiene `auth.users`.

**Resolución propuesta (no auto-resuelta — pregunta al usuario Q1):**
- **Opción A (recomendada):** `profiles` en Round 1 con `text('id').primaryKey()` (sin FK), UUID generado en app layer. En Round 6, swap a `uuid('id').primaryKey().references(() => authUsers.id)` o equivalente. Migración mecánica.
- **Opción B:** definir `profiles` con `text('id').primaryKey()` + columna `user_id` separada, y en Round 6 separar el mapeo.

**Por qué recomiendo A:** la propia historia dice en T1.1-08 "El Drizzle schema es el single source of truth … y es reusado en Round 6 contra Postgres per ADR-012". Cambiar la forma del PK entre rounds sería más invasivo que simplemente cambiar el tipo y añadir la FK.

### Edge cases identificados (cruzando con `qa-anti-patterns.md`)

1. **Cat. 5 (Cascade/Orphan):** el schema de `profiles` define `ON DELETE CASCADE` desde `auth.users`. En SQLite Round 1 esto se omite; **documentar en notas de implementación** que la integridad referencial se enforza en código (composición y repositorio), no en DB.
2. **Cat. 6 (Error Paths):** `db/client.ts` debe fallar con mensaje claro si `DATABASE_URL` no está, si el archivo `local.db` no es escribible, o si la migración no se ha corrido. **No usar `try {} catch {}` silencioso.**
3. **Cat. 7 (Migration):** `drizzle-kit generate` produce un solo SQL para la primera tabla. Round 6 (Postgres) requerirá un script de migración distinto; **dejar comentario en `db/schema.ts`** indicando que los tipos Drizzle cambian entre drivers.
4. **Cat. 9 (Type-safety):** vitest no type-checka por defecto. Julian debe correr `astro check` (o `tsc --noEmit`) en la verificación de AC-1.1-04, no solo confiar en que el build pase.

### Puntos de integración

- **Round 2+ importará** `SqliteXxxRepository` concretos desde la composición — debe haber al menos un patrón limpio (composition + abstract) para que la historia 1.2 (schema completo) solo tenga que añadir más tablas y `Sqlite*Repository` por cada una.
- **Story 1.3 (auth local)** importará la composición para resolver `ProfileRepository` cuando cree el perfil en el registro.
- **Story 1.4 (layout/nav)** solo necesita que `src/layouts/layout.astro` exista y se aplique por defecto en `src/pages/index.astro`.
- **Round 6** importará `db/schema.ts` y solo cambiará el driver Drizzle + tipos de columna.

### Preocupaciones de comportamiento legacy

- No hay comportamiento legacy — el proyecto es greenfield. **No aplica.**

### Preguntas para el usuario

> Have a proposal, or want my recommendation?

**Pregunta Q1 — Forma del PK de `profiles` en Round 1 (DISCREPANCY-1):**

> **Context:** la spec canónica `database-schema.md` define `profiles.id` como `UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` (Postgres + Supabase). SQLite no tiene `auth.users`. La historia exige que el schema sea reusable en Round 6 (ADR-012).
>
> **My recommendation:** **Opción A** — definir `profiles` con `text('id').primaryKey()` (sin FK) en Round 1, y dejar documentado en el schema que en Round 6 se cambia a `uuid('id').primaryKey().references(...)`. Migración mecánica, sin reescritura.
>
> **Alternatives considered:**
> - **Opción B:** `text('id').primaryKey()` + columna `user_id` separada apuntando a una futura `auth_users` local. Más trabajo en Round 1, mismo resultado en Round 6.
>
> **Tradeoff if alternative:** más tablas y más migraciones que se tiran a la basura en Round 6.
>
> **Recommendation:** **A**.

**Pregunta Q2 — ¿Qué contexto debe tener el primer composition file?**

> **Context:** la historia dice "Wire the composition root per ADR-010 (e.g. `src/lib/composition/workout.ts`)". El "e.g." deja ambigüedad.
>
> **My recommendation:** **`src/lib/composition/workout-tracking.ts`** (alineado 1:1 con la entidad `profiles` que vive en el dominio workout-tracking, y con el ejemplo de la ADR-010). Otros contextos (auth, user, nutrition) llegan en historias posteriores y traerán su propio composition file.
>
> **Alternatives considered:**
> - **`src/lib/composition/user.ts`** — el abstract se llama `ProfileRepository`, así que un composition "user" sería defendible. Pero el `profiles` está definido en el contexto `workout-tracking` (su DDL vive en `database-schema.md` junto a `workouts`).
> - **Composition genérico `src/lib/composition/index.ts`** — viola ADR-010 ("no central god file").
>
> **Tradeoff if alternative:** un composition "user" obligaría a mover el abstract `ProfileRepository` al contexto `user` en una historia futura, refactor extra.
>
> **Recommendation:** **`workout-tracking`**.

**Pregunta Q3 — ¿Dónde vive el concreto `SqliteProfileRepository`?**

> **Context:** la ADR-007 dice "every entity has a `SupabaseXxxRepository` and `SqliteXxxRepository` in `infrastructure/`". El ejemplo del ADR-010 los coloca en `infrastructure/sqlite/` y `infrastructure/supabase/`. La historia 1.1 dice `src/lib/repositories/` para los abstract pero no especifica la carpeta del concreto.
>
> **My recommendation:** **Layout alineado con ADR-010 al 100%:**
> - `src/lib/repositories/profile.repository.ts` (abstract)
> - `src/lib/repositories/sqlite/sqlite-profile.repository.ts` (concreto SQLite)
> - `src/lib/repositories/sqlite/index.ts` (barrel opcional)
> - **Dejar `src/lib/repositories/supabase/`** aunque esté vacío en Round 1, para que Round 6 solo añada archivos sin crear directorios nuevos.
>
> **Alternatives considered:**
> - **Colocar el concreto en `src/lib/repositories/`** junto al abstract — más simple para 1 archivo, pero rompe la simetría con `supabase/` y obliga a refactor en Round 6.
>
> **Tradeoff if alternative:** Round 6 tendrá que mover archivos.
>
> **Recommendation:** **layout ADR-010**.

**Pregunta Q4 — ¿Versiones de Astro y Drizzle a fijar?**

> **Context:** la historia no fija versiones. La fecha actual es 2026-07-25. Astro 5.x y Drizzle 0.36+ son los vigentes a la fecha.
>
> **My recommendation:** **últimas estables a la fecha** (`astro@^5`, `@astrojs/vercel@^8`, `drizzle-orm@^0.36`, `drizzle-kit@^0.28`, `better-sqlite3@^11`, `typescript@^5.6`). Sin pin exacto, usando `^` para recibir parches.
>
> **Alternatives considered:**
> - **Pin exacto** — más seguro contra breaking changes, pero bloquea parches de seguridad.
>
> **Tradeoff if alternative:** hay que bumpear a mano cada vez.
>
> **Recommendation:** **`^` con lockfile committeado**.

**Pregunta Q5 — ¿Tests en esta historia?**

> **Context:** la historia no pide tests. El golden rule "QA-First Thinking" dice "escribe el test QA antes que la implementación". Pero el alcance es scaffold — no hay comportamiento que probar más allá de "la DB se conecta y el cliente está tipado".
>
> **My recommendation:** **Mínimo aceptable:** un test smoke en `src/lib/db/client.test.ts` que verifique (a) que `db` se instancia sin throw, (b) que el `InferSelectModel<typeof profiles>` resuelve al tipo correcto. Sin test E2E (no hay UI).
>
> **Alternatives considered:**
> - **Cero tests** — la historia no los pide y el smoke se cubre con AC-1.1-03 (que el migrate corra).
>
> **Tradeoff if alternative:** AC-1.1-04 (autocomplete downstream) no queda probada por el migrate — solo por compilación.
>
> **Recommendation:** **smoke test unitario solo**.

### Gap summary

- **DONE:** 0
- **PARTIAL:** 0
- **DISCREPANCY:** 1 (PK de `profiles` — cubierta por Q1)
- **MISSING:** 12 tareas + 8 AC
- **NOT-STARTED:** 0

---

## User Decision

- **Q1:** Aceptada la recomendación (Opción A: `text('id').primaryKey()` sin FK en Round 1).
- **Q2:** El usuario quiere **composition por contexto** (alineado con ADR-010). Decisión: **`src/lib/composition/workout-tracking.ts`**.
- **Q3:** El usuario quiere **layout por contexto** (alineado con ADR-007/010). Decisión: `src/lib/repositories/<context>/<entity>.repository.ts` para abstract, `src/lib/repositories/<context>/sqlite/<entity>.repository.ts` para concreto, `src/lib/repositories/<context>/supabase/` creado vacío.
- **Q4:** Aceptada la recomendación (`^` con lockfile committeado).
- **Q5:** El usuario quiere tests, pero en la carpeta **`/tests`** (raíz del proyecto), no en `src/`. Ajustar:
  - `tests/db/client.test.ts` (smoke de `db` y de `InferSelectModel<typeof profiles>`).
  - Configurar Vitest para descubrir tests bajo `/tests` (no bajo `src/`).
  - **Implicación de arquitectura:** rompe la convención de que el código vive en `src/`. Documentar en notas de implementación y considerar mover a `src/` en Round 6 si se decide. Por ahora, respetar la decisión del usuario.

## Phase 1 — Cierre

"Gap analysis complete. All questions resolved. Handing off to Alefrank for alignment check."

---

## Phase 1.5 — Alefrank — Alignment Check (Round 1)

### Discrepancias encontradas

| # | Tipo | Descripción | Spec referencia | Severidad |
|---|------|-------------|-----------------|-----------|
| A1 | **faltante** | Angel no incluyó explícitamente la columna `weight_unit` ni `routine_type` del DDL canónico en el `profiles` de Round 1. La spec `database-schema.md` define `display_name`, `routine_type`, `weight_unit`, `created_at`. Aunque la historia 1.1 solo pide "al menos un `sqliteTable` (e.g. `profiles`)", Alefrank recomienda **dejar el DDL canónico completo** desde Round 1 para evitar una migración de ALTER TABLE en la historia 1.2 (que es la de schema completo + seed). | `database-schema.md` §profiles + `phase-1/readme.md` (regla de fase) | **Minor** |
| A2 | **faltante** | Angel no marcó la **ruta del adapter Vercel**: la historia dice "Astro project with `@astrojs/vercel` adapter" pero no dice si SSR o static output. Default razonable: `output: 'server'` (necesario para que las historias 1.2+/auth/DB funcionen en runtime, no en build). | `story-1.1.md` T1.1-01 | **Minor** |
| A3 | **faltante** | Tests en `/tests` (decisión Q5 del usuario): Vitest necesita un `vitest.config.ts` o que `astro.config` lo habilite. Por defecto Astro+Vite pone Vitest bajo `src/`. **Decisión de config** que Angel no documentó: ¿`vitest.config.ts` independiente o integración con Vite del proyecto? | golden-rules.md (test fixtures) + Q5 | **Minor** |
| A4 | **oversight** | El `db/client.ts` debe exportar también el **tipo** del cliente (`BetterSQLite3Database<typeof schema>`) para que el `SqliteProfileRepository` lo reciba tipado. Angel mencionó el cliente pero no su tipo exportado. | ADR-012 (type-safety end-to-end) + AC-1.1-04 | **Minor** |
| A5 | **oversight** | Falta documentar la convención de **imports absolutos** (`@/...`) — la ADR-010 los usa en sus ejemplos (`@/lib/config`, `@/lib/contexts/...`). Se debe configurar `tsconfig.json` con `paths: { "@/*": ["./src/*"] }` y el equivalente en `astro.config`. | ADR-010 ejemplos | **Minor** |
| A6 | **faltante** | No se menciona el script `dev` (Astro ya lo provee vía `astro dev`) ni `build`. La historia asume que existen. Confirmar que el `package.json` los exponga. | `story-1.1.md` AC-1.1-01 | **Minor** |
| A7 | **oversight** | `db/schema.ts` debe usar `sqliteTable` con columna `id` como `text` (PK). El ejemplo en el briefing dice `text('id').primaryKey()` pero **no se especificó** cómo se genera el UUID (cliente vs `crypto.randomUUID()` en app layer). Recomendación: `text('id').$defaultFn(() => crypto.randomUUID())` para que Round 6 solo tenga que cambiar el tipo a `uuid` y eliminar el default. | ADR-012 (single source of truth) + Q1 (round 1: sin FK) | **Minor** |
| A8 | **oversight** | Falta el **smoke test de migration**: además de probar que `db` se instancia, el test debe ejecutar `migrate()` contra una DB temporal (`:memory:` o `tmp/`) y verificar que `profiles` existe. Esto prueba AC-1.1-03 (migrate funciona) y la categoría 9 (type-safety del schema). | AC-1.1-03 + AC-1.1-04 + qa-anti-patterns cat. 9 | **Minor** |
| A9 | **oversight** | El `src/lib/composition/workout-tracking.ts` no existe como path. ADR-010 pone los compositions dentro de cada context: `src/lib/contexts/<context>/<context>.composition.ts`. La **historia 1.1** dice "e.g. `src/lib/composition/workout.ts`" — esto es **DISCREPANCY-2** entre la historia y la ADR-010. Necesita resolución. | `story-1.1.md` T1.1-09 vs ADR-010 | **MAJOR** |

### Resolución solicitada (A9)

**A9 — Layout de los composition files (DISCREPANCY-2):**

La historia 1.1 dice "Wire the composition root per ADR-010 (e.g. `src/lib/composition/workout.ts`)". La ADR-010 dice:

> `src/lib/contexts/auth/auth.composition.ts`
> `src/lib/contexts/workout-tracking/workout-tracking.composition.ts`

Son dos paths distintos:
- **Historia:** `src/lib/composition/<contexto>.ts` (en `src/lib/`)
- **ADR-010:** `src/lib/contexts/<contexto>/<contexto>.composition.ts` (dentro de cada context)

**Mi recomendación (Alefrank):** seguir la **ADR-010** porque:
1. La historia dice "per ADR-010" explícitamente — la historia referencia la ADR, no la contradice.
2. La ADR-010 está aceptada (status: accepted, 2026-07-21).
3. La frase "e.g. `src/lib/composition/workout.ts`" es un ejemplo, no una imposición literal — la ADR-010 es la fuente de verdad.
4. **Pero esto contradice Q2** (mi recomendación anterior que el usuario aprobó: `src/lib/composition/workout-tracking.ts`).

Necesito que Angel rectifique Q2 contra la ADR-010, y que el usuario re-confirme o anule.

### Verdict

**NEEDS ANOTHER ROUND + ESCALATE TO USER for A9 (DISCREPANCY-2).**

Angel rectifica A1–A8 en Round 2. A9 escala al usuario.

---

## Angel — Rectification (Round 2)

### Correcciones

- **A1 (profile columns completas):** `db/schema.ts` definirá `profiles` con `id`, `display_name`, `routine_type`, `weight_unit`, `created_at` según `database-schema.md` §profiles. `routine_type` y `weight_unit` usarán `text({ enum: [...] })` de Drizzle para enforce en type-level; en SQLite no hay CHECK enforcement, eso queda al composition/repository. Documentar en notas.
- **A2 (Vercel adapter output):** `astro.config.mjs` con `output: 'server'` y `adapter: vercel()`. Necesario para SSR (auth, DB en runtime).
- **A3 (Vitest config):** `vitest.config.ts` independiente en raíz, con `test.include: ['tests/**/*.test.ts']`. Documentar el porqué de la separación del patrón por defecto de Astro.
- **A4 (tipo del cliente exportado):** `client.ts` exporta `db` y `Db` (tipo `BetterSQLite3Database<typeof schema>`).
- **A5 (imports absolutos):** `tsconfig.json` con `baseUrl: '.'` y `paths: { "@/*": ["./src/*"] }`. Equivalente en Vite via `vite.resolve.alias` en `astro.config.mjs`.
- **A6 (scripts):** `package.json` incluye `dev`, `build`, `preview`, `db:generate`, `db:migrate`, `db:studio`, `test`, `test:run`, `typecheck`.
- **A7 (UUID default):** `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())` en `profiles`. En Round 6 se cambia a `uuid('id').primaryKey().defaultRandom()` y se añade `.references(...)`.
- **A8 (smoke test de migrate):** `tests/db/migrate.test.ts` ejecuta `migrate()` contra `':memory:'` (Drizzle soporta esto) y verifica que `db.select().from(profiles).all()` retorna `[]` sin throw, y que `InferSelectModel<typeof profiles>` resuelve al shape correcto.

### Corrección solicitada a Q2 (DISCREPANCY-2 con ADR-010)

Rectifico mi recomendación anterior de Q2:

- **Antes (recomendado):** `src/lib/composition/workout-tracking.ts`
- **Ahora (alineado con ADR-010):** `src/lib/contexts/workout-tracking/workout-tracking.composition.ts`
- **Razón:** la ADR-010 es la fuente de verdad. La historia dice "per ADR-010" explícitamente. La frase "e.g." es ilustrativa.

Esto requiere re-confirmación del usuario (escalado por A9).

### AC actualizados

- AC-1.1-01: `npm run dev` arranca Astro en `output: 'server'`. ✓
- AC-1.1-02: `drizzle-kit generate` produce SQL versionado en `db/migrations/`. ✓
- AC-1.1-03: `drizzle-kit migrate` aplica SQL y crea `profiles` (con todas las columnas canónicas). ✓ Cubierto también por `tests/db/migrate.test.ts`.
- AC-1.1-04: `src/lib/db/client.ts` exporta `db` y `Db`. Tipos fluyen end-to-end. ✓ Cubierto por smoke test y `typecheck`.
- AC-1.1-05: Abstract `ProfileRepository` en `src/lib/contexts/workout-tracking/domain/profile.repository.ts`. ✓
- AC-1.1-06: `SqliteProfileRepository` en `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts`, wired via `src/lib/contexts/workout-tracking/workout-tracking.composition.ts`. ✓
- AC-1.1-07: Landing renderiza en `/`. ✓
- AC-1.1-08: `db/schema.ts` reusable en Round 6 con cambios mecánicos (tipo de id + FK a `auth.users`). ✓ Documentado en `db/schema.ts` (header comment).

---

## User Decision (Round 2)

- **A9:** Aceptada la recomendación (ADR-010).
- **Acción adicional del usuario:** "arregla las otras storys para que sigan este convencion".
  - **Inventario de paths concretos en Round 1–6:**
    - `story-1.1.md` — 4 paths literales a corregir (T1.1-07, T1.1-09, AC-1.1-05, AC-1.1-08 + prosa).
    - `ADR-007` línea 91 — "Composition root (`src/lib/composition/container.ts`)" contradice ADR-010.
    - `ADR-012` línea 39 — "`src/lib/repositories/sqlite/`" como ubicación global contradice la convención per-context.
    - **Stories 1.2, 1.3, 1.4, 6.x:** usan solo lenguaje abstracto ("per-context composition", "XxxRepository base") — **no requieren cambios** (ya conformes).
  - **Plan de correcciones** (se aplican ahora):
    1. Editar `story-1.1.md`: paths per-context.
    2. Editar `ADR-007`: aclarar que "composition root" significa el archivo per-context, no `src/lib/composition/container.ts`.
    3. Editar `ADR-012`: "Drizzle-backed implementation lives entirely in the per-context `infrastructure/sqlite/` folder" en vez de `src/lib/repositories/sqlite/`.

---

## Phase 1.5 — Cierre

"Angel and I are aligned. Spec coverage is complete. No legacy behavior at risk. I approve Julian to start implementation."

**Nota sobre decisión de tests del usuario:** carpeta `/tests` en raíz (no `src/`). Documentado en notas; el `vitest.config.ts` descubrirá tests bajo `tests/**/*.test.ts`.

---

## Phase 2 — Alefrank — Implementation Plan

### Gap Summary (from Angel)
- DONE: 0 · PARTIAL: 0 · DISCREPANCY: 1 (resuelta) · MISSING: 12 tareas + 8 AC · NOT-STARTED: 0

### Plan Summary

Scaffolding greenfield de una app Astro 5 + Drizzle ORM 0.36 + SQLite (better-sqlite3 11) + adapter Vercel SSR. Se entrega:

- `package.json` + `tsconfig.json` (paths `@/*`) + `astro.config.mjs` (output: 'server', Vercel adapter, alias Vite).
- `drizzle.config.ts` con dialect `sqlite` apuntando a `db/schema.ts` y `db/migrations/`.
- `db/schema.ts` con `profiles` (todas las columnas canónicas: `id`, `display_name`, `routine_type`, `weight_unit`, `created_at`) y un header comment documentando el swap a Postgres en Round 6.
- `src/lib/db/client.ts` exportando `db` (instancia) y `Db` (tipo `BetterSQLite3Database<typeof schema>`). **Una sola instancia por proceso.**
- `src/lib/contexts/workout-tracking/domain/profile.repository.ts` (abstract).
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts` (concreto) + `infrastructure/supabase/` vacío.
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` que selecciona por `STORAGE_BACKEND`.
- `src/layouts/layout.astro` + `src/pages/index.astro`.
- `tests/db/client.test.ts` (smoke: `db` instancia + tipos Drizzle inferidos).
- `tests/db/migrate.test.ts` (smoke: `migrate()` contra `:memory:` + tipos Drizzle inferidos).
- `vitest.config.ts` en raíz con `test.include: ['tests/**/*.test.ts']`.
- `.env.example` + `.env` con `DATABASE_URL=file:./local.db` y `STORAGE_BACKEND=sqlite`.
- Scripts npm: `dev`, `build`, `preview`, `typecheck`, `test`, `test:run`, `db:generate`, `db:migrate`, `db:studio`.

### Implementation Steps

1. **Init proyecto.** Crear `package.json` (type: module, scripts, deps) y `tsconfig.json` con `paths: { "@/*": ["./src/*"] }`.
2. **Astro config.** Crear `astro.config.mjs` con `output: 'server'`, `adapter: vercel()`, alias Vite `@`.
3. **Drizzle config + schema.** Crear `drizzle.config.ts` (dialect `sqlite`, schema `db/schema.ts`, migrations `db/migrations/`) y `db/schema.ts` con `profiles` completo (incluyendo header comment del swap Round 6).
4. **Cliente DB.** Crear `src/lib/db/client.ts` con `db` + tipo `Db` exportados. **Una sola instancia por proceso.**
5. **Abstract repo.** Crear `src/lib/contexts/workout-tracking/domain/profile.repository.ts`.
6. **Concreto repo.** Crear `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts` + `infrastructure/supabase/.gitkeep`.
7. **Composition root.** Crear `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` con `STORAGE_BACKEND` switch.
8. **UI mínima.** Crear `src/layouts/layout.astro` (HTML5 shell) y `src/pages/index.astro`.
9. **Tests + Vitest config.** Crear `vitest.config.ts` (include: `tests/**/*.test.ts`), `tests/db/client.test.ts`, `tests/db/migrate.test.ts`.
10. **Env.** Crear `.env.example` + `.env` con `DATABASE_URL` y `STORAGE_BACKEND`.
11. **Verificación (gates).** Correr en orden: `npm install` → `npm run db:generate` → `npm run db:migrate` → `npm run typecheck` → `npm run test:run` → `npm run dev` (smoke en `/`).
12. **Self-QA (Phase 3 Step 2e).** Checklist de cat. 5/6/7/9 contra el código.

### Selected Skills

- **No se cargan skills externos.** Las decisiones de stack son explícitas en la historia + ADRs; no hay skill de Astro/Drizzle/Vitest registrado en `<available_skills>`.

### Pattern Contracts

- **None** — no existen `*.pattern.md` para scaffold. Julian sigue:
  - kebab-case para filenames (per `components.md`)
  - `implements` no `extends` (per `ADR-011`)
  - per-context composition (per `ADR-010`)
  - per-context repository layout (per `ADR-007`/`ADR-012` corregido)
  - Golden rules: null policy, schema contracts, side-effect-free reads, SOLID (DIP para composition root), QA-first

### Legacy Watchlist

- **None.** Greenfield. No hay código que preservar. **No aplica** la sección "Why This Wasn't Caught Before" del formato fix.

### Applicable Golden Rules

- **Null Policy** (no `null` en domain/application → `T | undefined`; invalid state → throw)
- **Schema Contracts** (no untyped blobs; `text({ enum: [...] })` para `routine_type` y `weight_unit`)
- **Side-Effect Free Reads** (los métodos `get*`/`find*` no escriben)
- **DDD / Repositories** (return aggregates or throw; `find*` → `T | undefined`, `get*` throws)
- **SOLID / DIP** (composition root inyecta dependencias; use cases no instancian concretos)
- **API Design** (input validation en boundary; mensajes de error claros en `db/client.ts`)
- **Best Practices** (UUID default vía `$defaultFn(() => crypto.randomUUID())` para portabilidad a Round 6)
- **QA-First** (smoke tests ANTES de declarar AC verde)

### QA Anti-Patterns (de `qa-anti-patterns.md`)

- **Categorías relevantes (de Phase 0):** 5, 6, 7, 9.
- **Self-QA plan (Phase 3 Step 2e):**
  - **Cat. 5 (Cascade/Orphan):** verificar que el comentario en `db/schema.ts` documenta la **ausencia** de FK a `auth.users` en Round 1 y la intención de añadirla en Round 6. La integridad referencial se enforza en composición/repositorio.
  - **Cat. 6 (Error Paths):** `db/client.ts` debe fallar con mensaje claro si `DATABASE_URL` no está o el archivo no es escribible. Sin `try {} catch {}` silencioso.
  - **Cat. 7 (Migration):** el SQL generado por `drizzle-kit generate` debe ser revisable y committeado; el header comment de `db/schema.ts` debe advertir del port a Postgres.
  - **Cat. 9 (Type-safety):** ejecutar `astro check` o `tsc --noEmit` (no solo Vitest) para AC-1.1-04; los tests deben usar `InferSelectModel<typeof profiles>` y `InferInsertModel<typeof profiles>` para probar el autocomplete end-to-end.
- **Fely focus areas (Phase 4):**
  - Verificar manualmente que `npm run dev` arranca (gates AC-1.1-01/07).
  - Verificar que `db/migrate` crea `local.db` con `profiles` y todas las columnas (AC-1.1-03).
  - Verificar que cambiar `STORAGE_BACKEND` (en `.env`) hace que el composition root enrute al impl correcto (sin importar que `supabase` aún no exista — debe fallar con error claro, no crashear silencioso).
  - Confirmar que la carpeta vacía `infrastructure/supabase/` tiene al menos un `.gitkeep` para que git la trackee.

### Verdict

**PRESENTED FOR REVIEW — Waiting for user approval.**

---

## Alefrank — Plan Ready for Review

### Session Summary
- **Story:** 1.1 — Project Scaffold (Astro + Drizzle + SQLite)
- **Description:** scaffold greenfield del proyecto: Astro 5 SSR + Drizzle ORM 0.36 + SQLite + adapter Vercel + cliente DB tipado + abstract `ProfileRepository` + `SqliteProfileRepository` concreto + composition per-context + landing page + smoke tests en `/tests`.
- **Specs reviewed:** `story-1.1.md`, `phase-1/readme.md`, ADRs 007/010/011/012, `components.md`, `contexts/workout-tracking/readme.md`, `database-schema.md`, `prd/features/workout-tracking.md`.
- **Patterns found:** ninguno específico de scaffold; convenciones inferidas de `components.md` (kebab-case) + ADRs (per-context composition, `implements` not `extends`).
- **Gap totals:** DONE 0 · PARTIAL 0 · DISCREPANCY 1 (resuelta en Q1) · MISSING 12 tareas + 8 AC · NOT-STARTED 0.
- **Key decisions made:**
  - Q1: PK de `profiles` con `text('id').$defaultFn(() => crypto.randomUUID())` (portable a Round 6).
  - Q2/Q3: layout per-context (`src/lib/contexts/<ctx>/...`) por ADR-010; carpeta `infrastructure/supabase/` vacía para que Round 6 solo añada archivos.
  - Q4: versiones con `^` + lockfile committeado.
  - Q5: tests en `/tests` (raíz) — `vitest.config.ts` independiente con `include: ['tests/**/*.test.ts']`.
  - A1–A9: correcciones a `story-1.1.md`, `ADR-007`, `ADR-012` para alinear paths con la convención per-context (ya aplicadas).

### Proposed Implementation Plan

Construir un esqueleto mínimo pero production-shaped de la app:

1. Init del proyecto (`package.json`, `tsconfig.json`, `astro.config.mjs` con SSR + Vercel + alias `@`).
2. Stack de datos (`drizzle.config.ts`, `db/schema.ts` con `profiles` completo + header comment del swap a Postgres, `src/lib/db/client.ts` con `db` y `Db`).
3. Capa de dominio per-context (`ProfileRepository` abstract, `SqliteProfileRepository` concreto, `supabase/` vacío con `.gitkeep`).
4. Composition per-context con `STORAGE_BACKEND` switch.
5. UI mínima (`layout.astro` + `index.astro`).
6. Smoke tests en `/tests` + `vitest.config.ts`.
7. Env files + scripts npm.
8. Verificación: install → generate → migrate → typecheck → test → dev.

### Files Julian will touch (todos nuevos)
- `package.json`, `tsconfig.json`, `astro.config.mjs`, `drizzle.config.ts`, `.env.example`, `.env`, `.gitignore`
- `db/schema.ts`, `db/migrations/.gitkeep`
- `src/lib/db/client.ts`
- `src/lib/contexts/workout-tracking/domain/profile.repository.ts`
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts`
- `src/lib/contexts/workout-tracking/infrastructure/supabase/.gitkeep`
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts`
- `src/layouts/layout.astro`, `src/pages/index.astro`
- `tests/db/client.test.ts`, `tests/db/migrate.test.ts`
- `vitest.config.ts`

### Skills Loaded for This Task
- Ninguna externa (no hay skills de Astro/Drizzle/Vitest registradas en `<available_skills>`).

### What Julian will do
1. Crear todos los archivos listados arriba en el orden de "Implementation Steps".
2. Correr `npm install` y los gates de verificación.
3. Correr self-QA (cat. 5/6/7/9) antes de handoff.
4. Si encuentra issues, arreglarlos antes de pedir review de Fely.

### What Julian will NOT do
- **No** instalará Supabase ni importará `@supabase/supabase-js` (regla de fase: "No Supabase hasta Round 6").
- **No** creará la carpeta central `src/lib/composition/` ni `src/lib/repositories/` (ADR-010, ADR-007/012 corregidos).
- **No** añadirá más tablas (eso es historia 1.2).
- **No** implementará auth (eso es historia 1.3).
- **No** implementará navigation/layout shell completo (eso es historia 1.4).
- **No** añadirá tests E2E/Playwright (no hay UI más allá de la landing).
- **No** hará pin exacto de versiones (`^` con lockfile).

### Legacy behaviors being preserved
- **None.** Proyecto greenfield. No aplica.

---

**Review el plan de arriba. ¿Se ve correcto?**

- Si sí → escribe "approve" y Julian arranca.
- Si no → dime qué cambiar y ajusto.

---

## Phase 3 — Julian — Implementation

### Tests Written (TDD red→green)

| Archivo | Cobertura |
|---|---|
| `tests/db/client.test.ts` | AC-1.1-04: tipos Drizzle inferidos (`Profile`, `NewProfile`); runtime smoke contra in-memory DB. |
| `tests/db/migrate.test.ts` | AC-1.1-02/03: el SQL generado existe, crea `profiles` con todas las columnas canónicas, y `db/schema.ts` documenta el swap a Round 6. |
| `tests/workout-tracking/composition.test.ts` | AC-1.1-05/06: el composition root selecciona por `STORAGE_BACKEND` (sqlite, supabase→throw, invalid→throw). |
| `tests/workout-tracking/sqlite-profile.repository.test.ts` | AC-1.1-06: `SqliteProfileRepository` end-to-end (create, findById, findByEmail, update, throws on not-found). |

### Implementation Changes

Todos archivos nuevos en `c:\Users\IK\Desktop\dev\gym-up`:

- `package.json` — deps con `^` + lockfile, scripts `dev`/`build`/`preview`/`typecheck`/`test`/`test:run`/`db:generate`/`db:migrate`/`db:studio`.
- `tsconfig.json` — extiende `astro/tsconfigs/strict`, paths `@/* → ./src/*`, types vitest.
- `astro.config.mjs` — `output: 'server'`, adapter `@astrojs/vercel`, alias Vite `@`.
- `drizzle.config.ts` — dialect `sqlite`, schema `db/schema.ts`, migrations `db/migrations/`, `strict: true`.
- `vitest.config.ts` — alias `@`, `include: ['tests/**/*.test.ts']`.
- `.env.example`, `.env`, `.gitignore` (extendido con `*.db`).
- `db/schema.ts` — `profiles` con las 5 columnas canónicas (`id`, `displayName`, `routineType`, `weightUnit`, `createdAt`) + header comment documentando el swap a Postgres en Round 6. UUID por `crypto.randomUUID()`.
- `db/migrations/0000_flowery_blink.sql` — generado por `drizzle-kit generate` (commiteable).
- `db/migrations/.gitkeep` — trackea la carpeta.
- `src/lib/db/client.ts` — `db` (instancia) + `Db` (tipo). Carga `.env` si `DATABASE_URL` ausente. Mensajes de error claros.
- `src/lib/contexts/workout-tracking/domain/profile.repository.ts` — abstract class.
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts` — concreto `implements ProfileRepository`.
- `src/lib/contexts/workout-tracking/infrastructure/supabase/.gitkeep` — carpeta vacía para Round 6.
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — `STORAGE_BACKEND` switch; exporta `profileRepository` + `workoutTrackingBackend`.
- `src/layouts/layout.astro` — kebab-case, slot default.
- `src/pages/index.astro` — landing con `storage-backend` visible (`data-testid`).
- `tests/...` — 4 archivos, 18 tests.
- `scripts/inspect-db.mjs` — utilidad dev (no en producción).

### Test Results
- **New tests:** 18 passed / 0 failed (4 files).
- **Typecheck (`astro check`):** 15 files, 0 errors, 0 warnings, 0 hints.
- **Regressions:** none (suite completa verde, 0 pre-existing failures).
- **Dev server (`npm run dev`):** arranca en `http://localhost:4321/`, `GET /` → **HTTP 200**, 28ms. Storage backend visible en HTML como `sqlite`.
- **DB:** `local.db` con tabla `profiles` (5 columnas canónicas) + tabla de migraciones de Drizzle.

### Self-QA (Step 2e) — Anti-Pattern Checks

Categorías activas: **5, 6, 7, 9**.

| # | Categoría | Check | Resultado | Notas |
|---|-----------|-------|-----------|-------|
| 1 | **Cat. 5 (Cascade/Orphan)** | ¿El schema documenta la ausencia de FK a `auth.users` en Round 1? | **PASS** | Header comment en `db/schema.ts` (líneas 1-25) enumera los 5 pasos del swap a Round 6, incluyendo el FK. Test `tests/db/migrate.test.ts` verifica que el comment existe. |
| 2 | **Cat. 5** | ¿La integridad referencial se enforce en el composition/repository? | **PASS** | Solo `profiles` existe en este story; la guarda de ownership se materializa en repos que tocan `user_id` (story 1.2). En este story no aplica FK. |
| 3 | **Cat. 6 (Error Paths)** | ¿`db/client.ts` falla con mensaje claro si `DATABASE_URL` falta? | **PASS** | Verificado en vivo: el dev server respondió **HTTP 500 con mensaje "DATABASE_URL is not set. Copy .env.example to .env before booting the app."** antes del fix. Después del fix, carga `.env` automáticamente. Sin `try {} catch {}` silencioso. |
| 4 | **Cat. 6** | ¿El composition root lanza error claro si `STORAGE_BACKEND=supabase` en Round 1? | **PASS** | Test `composition.test.ts > throws a clear error when STORAGE_BACKEND=supabase in Round 1` verifica `rejects.toThrow(/Round 6/)`. |
| 5 | **Cat. 6** | ¿El composition root lanza error claro si `STORAGE_BACKEND` es inválido? | **PASS** | Test `composition.test.ts > throws a clear error when STORAGE_BACKEND is invalid` verifica `rejects.toThrow(/Invalid STORAGE_BACKEND/)`. |
| 6 | **Cat. 6** | ¿`SqliteProfileRepository.update` lanza si el profile no existe? | **PASS** | Test `sqlite-profile.repository.test.ts > update() throws when the profile does not exist`. |
| 7 | **Cat. 7 (Migration)** | ¿El SQL generado es versionado y commiteable? | **PASS** | `db/migrations/0000_flowery_blink.sql` existe; test `migrate.test.ts` verifica que crea `profiles` con `display_name`, `routine_type`, `weight_unit`, `created_at`. |
| 8 | **Cat. 7** | ¿El header del schema advierte del port a Postgres? | **PASS** | Test `migrate.test.ts > db/schema.ts has a top-level comment documenting the Round 6 swap`. |
| 9 | **Cat. 9 (Type-safety)** | ¿`tsc --noEmit` / `astro check` pasa (no solo Vitest)? | **PASS** | `astro check` reporta **0 errors, 0 warnings, 0 hints en 15 files**. |
| 10 | **Cat. 9** | ¿`InferSelectModel<typeof profiles>` resuelve a un tipo correcto? | **PASS** | Test `client.test.ts > Profile type resolves to the canonical row shape` (compilación). |
| 11 | **Cat. 9** | ¿`InferInsertModel<typeof profiles>` permite omitir `id` y `createdAt`? | **PASS** | Test `client.test.ts > NewProfile type lets id and createdAt be omitted`. |
| 12 | **Cat. 9** | ¿El enum `routine_type` rechaza valores inválidos en type-level? | **PASS** | Test `client.test.ts > routine_type enum rejects invalid values at the type level` con `@ts-expect-error`. |
| 13 | **Cat. 9** | ¿Los imports `@/*` resuelven? | **PASS** | `tsconfig.json` paths + Vite alias en `astro.config.mjs` + Vitest alias. La landing (`src/pages/index.astro`) usa `@/layouts/layout.astro` y `@/lib/contexts/...` y renderiza HTTP 200. |

### Issues Found & Fixed
- **Fix #1 (cat. 6 — env loading):** Astro SSR no inyecta `process.env.DATABASE_URL` desde `.env` automáticamente para módulos fuera de `src/`. El primer `GET /` devolvió **HTTP 500** con el mensaje de error correcto. Implementé un `loadDotEnvIfPresent()` minimalista en `client.ts` que respeta las reglas: solo si `DATABASE_URL` ausente, lee `.env` desde `cwd`, ignora comentarios y respeta quotes. **Después del fix, `GET /` → HTTP 200, 28ms.**
- **Fix #2 (tests):** la primera corrida tuvo 2 fallos — (a) `composition.test.ts` importaba el módulo con cache, así que cambios en `STORAGE_BACKEND` entre tests no se veían; (b) `sqlite-profile.repository.test.ts` tenía un path relativo incorrecto. Resuelto con `vi.resetModules()` y paths corregidos.
- **Fix #3 (typecheck):** el `@ts-expect-error` estaba en la línea de la declaración, no en la del campo. Movido a la línea exacta del campo problemático.

### Gaps for Fely (Phase 4)
- Verificar manualmente que `npm run dev` arranca limpio desde cero (sin `local.db` previo) y que `db:migrate` corre sin error.
- Verificar que cambiar `STORAGE_BACKEND` en `.env` a un valor inválido hace que la composición falle con mensaje claro en el endpoint `/` (no en import-time, no en runtime silencioso).
- Verificar visualmente que el `data-testid="storage-backend"` aparece en el HTML.
- **No** hay UI más allá de la landing, así que Playwright/E2E no aplica en este story.

### Status

**Implementation complete. All tests green. Handing off to Fely for QA review.**

---

## Phase 4 — Fely — QA Report

### Spec Compliance

| AC | Descripción | ¿Implementado? | ¿Testeado? | Notas |
|---|---|---|---|---|
| AC-1.1-01 | `npm run dev` arranca | **YES** | YES | `[200] / 28ms` en vivo, `astro v5.18.2 ready in 509 ms` |
| AC-1.1-02 | `drizzle-kit generate` produce SQL versionado | **YES** | YES | `db/migrations/0000_flowery_blink.sql` + test `migrate.test.ts > a versioned SQL file exists` |
| AC-1.1-03 | `drizzle-kit migrate` crea `profiles` en `local.db` | **YES** | YES | DDL verificada en vivo vía `inspect-db.mjs`; test `migrate.test.ts > the generated SQL creates the 'profiles' table` |
| AC-1.1-04 | `db` tipado, autocomplete downstream | **YES** | YES | `InferSelectModel`/`InferInsertModel` resuelven; `astro check` 0 errors; landing renderiza con tipos correctos |
| AC-1.1-05 | Abstract `XxxRepository` definidos per context | **YES** | YES | `ProfileRepository` en `src/lib/contexts/workout-tracking/domain/profile.repository.ts`; composition test verifica instanciación |
| AC-1.1-06 | Al menos un `SqliteXxxRepository` concreto + composition | **YES** | YES | `SqliteProfileRepository` con 6 tests (create, findById, findByEmail, update, not-found throw, ...); composition root testeado para sqlite/supabase/invalid |
| AC-1.1-07 | Landing renderiza en `/` | **YES** | YES | HTTP 200, `<h1>Gym Up</h1>` + `<code data-testid="storage-backend">sqlite</code>` presentes |
| AC-1.1-08 | `db/schema.ts` reusable en Round 6 | **YES** | YES | Header comment documenta los 5 pasos del swap; test `migrate.test.ts > db/schema.ts has a top-level comment documenting the Round 6 swap` |

### Pattern Compliance

| Pattern / Decisión | ¿Seguido? | Notas |
|---|---|---|
| **ADR-007** — abstract class, dual impls, `implements` not `extends` | YES | `SqliteProfileRepository implements ProfileRepository` (no `extends`). |
| **ADR-010** — per-context composition files, no central root | YES | `workout-tracking.composition.ts` en su context folder. No `src/lib/composition/` ni `src/lib/repositories/` centralizado. |
| **ADR-011** — `implements`, not `extends` | YES | Concreto usa `implements`. |
| **ADR-012** — Drizzle como abstracción, schema como source of truth | YES | `db/schema.ts` con `sqliteTable` + header comment Postgres swap. |
| **`components.md`** — kebab-case filenames | YES | Todos los archivos nuevos en kebab-case (`profile.repository.ts`, `sqlite-profile.repository.ts`, `workout-tracking.composition.ts`, `layout.astro`, `index.astro`). |
| **Regla de fase "no Supabase hasta Round 6"** | YES | `package.json` no incluye `@supabase/supabase-js`. Composition throws si `STORAGE_BACKEND=supabase`. |
| **`@/*` path alias (ADR-010 ejemplos)** | PARCIAL | `tsconfig.json` y Vite configurados. **Pero** 5 imports dentro de `src/` aún usan paths relativos (`../../../../../db/schema` x3, `../../domain/profile.repository` x1, `../../../db/schema` x1). Funcionalmente correcto, pero code smell — ver Issues #1. |

### Test Quality

- **17/18 tests validados contra el spec.** Tests son específicos, no smoke-and-trust:
  - `client.test.ts`: cada tipo Drizzle (`Profile`, `NewProfile`) se valida con un valor de muestra + `@ts-expect-error` para el enum inválido. Runtime smoke con `:memory:` cubre insert + select.
  - `migrate.test.ts`: valida que el SQL generado menciona `profiles`, `display_name`, `routine_type`, `weight_unit`, `created_at`. **No** solo "archivo existe".
  - `composition.test.ts`: cubre los 3 caminos (`sqlite` happy path, `supabase` round 1 throw, invalid throw). Usa `vi.resetModules()` para que cada test vea su propio env.
  - `sqlite-profile.repository.test.ts`: cubre create, findById, findById-not-found, update happy, update-throws-on-not-found, findByEmail stub.
- **Faltante menor:** el test de `findById` con `:memory:` no verifica que el `limit(1)` realmente se respete (Drizzle lo hace por construcción; no es crítico).
- **Cero tests que pasen sin validar el spec.** Ningún `it.skip`, ningún `it.todo` residual.

### Legacy Behavior
- **N/A** — greenfield. No hay comportamiento legacy a preservar.

### Anti-Pattern Analysis (qa-anti-patterns.md)

Categorías relevantes (de Phase 0): **5, 6, 7, 9**.

| # | Cat. | Julian Self-QA | Fely Verification | Resultado |
|---|------|----------------|-------------------|-----------|
| 1 | **5 (Cascade/Orphan)** | PASS | Re-leído `db/schema.ts` líneas 1-25: header documenta 5 pasos del swap incluyendo FK a `auth.users`. Test `migrate.test.ts` verifica el comment. | **PASS** |
| 2 | **6 (Error Paths)** | PASS (3 checks) | Re-ejecutado en vivo: `STORAGE_BACKEND=invalid-backend` → `HTTP 500` con mensaje `Invalid STORAGE_BACKEND="invalid-backend". Expected 'sqlite' (Rounds 1-5) or 'supabase' (Round 6).` + stack trace apuntando a `workout-tracking.composition.ts:18`. Sin `try {} catch {}` silencioso. | **PASS** |
| 3 | **6 (Error Paths)** | PASS | Re-leído `db/client.ts:58-62`: throw con mensaje accionable si `DATABASE_URL` ausente. Verificado en vivo al inicio de la sesión (HTTP 500 antes del fix). | **PASS** |
| 4 | **6 (Error Paths)** | PASS | `update()` throws `Profile not found: ${id}` — verificado en test. | **PASS** |
| 5 | **7 (Migration)** | PASS | Re-leído `0000_flowery_blink.sql`: CREATE TABLE profiles con 5 columnas, defaults coherentes. Tabla `__drizzle_migrations` presente. | **PASS** |
| 6 | **7 (Migration)** | PASS | Header del schema advierte del swap a Postgres. Test verifica. | **PASS** |
| 7 | **9 (Type-safety)** | PASS | `astro check` 15 files, 0 errors. **No** se confió solo en Vitest. | **PASS** |
| 8 | **9 (Type-safety)** | PASS | `InferSelectModel<typeof profiles>` resuelto, `@ts-expect-error` en línea correcta, imports `@/*` resuelven. | **PASS** |
| 9 | **Best Practices (golden rules)** — **imports relativos** | **NOT CHECKED** | Fely encontró **5 imports relativos `../../../../../`** en 3 archivos donde el alias `@/*` ya está configurado. **Code smell** (no es bug funcional). Ver Issues #1. | **ISSUE** |
| 10 | **Naming (golden rules)** | — | `SqliteProfileRepository` ✓; `ProfileRepository` ✓; `workoutTrackingBackend` (camelCase export) ✓; archivos kebab-case ✓. | **PASS** |
| 11 | **SOLID / DIP** | — | Composition root inyecta `db` en `SqliteProfileRepository` (DIP ✓). `ProfileRepository` no es una interface plana (es abstract class per ADR-007) — `implements` ✓. | **PASS** |
| 12 | **QA-First** | PASS | Tests escritos antes / en paralelo al implementation. Self-QA ejecutó 13 checks. Fely re-verifica 12. | **PASS** |

**Resumen de cobertura anti-pattern:**
- Julian cubrió: 5, 6, 7, 9 (4 categorías, 13 checks).
- Fely adicional: 9 (imports relativos, missed por Julian), 10 (naming), 11 (SOLID), 12 (QA-First) — **4 categorías adicionales**.

### Issues Found

1. **Imports relativos con `../`x4–6 deberían usar el alias `@/*`** (code smell, no bug).
   - `src/lib/db/client.ts:13` — `import * as schema from '../../../db/schema';` → debería ser `import * as schema from '@/../db/schema';` (o mover `db/schema.ts` a `src/db/`, decisión de scope).
   - `src/lib/contexts/workout-tracking/domain/profile.repository.ts:9` — `import type { Profile, NewProfile } from '../../../../../db/schema';` → `import type ... from '@db/schema';` o `@/../db/schema`.
   - `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository.ts:16-17` — `import { profiles, ... } from '../../../../../../db/schema';` y `import { ProfileRepository } from '../../domain/profile.repository';` → `from '@db/schema';` y `from '@/lib/contexts/workout-tracking/domain/profile.repository';`.
   - **Impacto:** funcionalmente correcto (typecheck pasa, 18/18 tests verdes). Pero el smell predice problemas: cualquier refactor de `db/` o `lib/contexts/...` requiere tocar estos archivos. La ADR-010 explícitamente usa `@/lib/contexts/...` en sus ejemplos — estamos inconsistent.
   - **Severidad:** **MINOR** (no bloquea ship, pero el QA loop de Fely es la primera oportunidad de detectar drift de convención).
   - **Por qué no se cazó en self-QA:** el self-QA se centró en las 4 categorías de `qa-anti-patterns.md` declaradas en Phase 0; "imports relativos" no es una categoría de anti-pattern, es golden-rules "Best Practices" (predictabilidad de paths).
   - **Decisión del usuario necesaria:** ¿Arreglar ahora (Fely → Julian → re-QA) o documentar como follow-up para que el smell no se propague en 1.2/1.3/1.4 cuando se añadan más repos?

### Known Bugs Cleanup
- Búsqueda de `**/known-bugs.md`: **0 archivos encontrados**. No hay base de bugs preexistente que limpiar.

### Verdict

**PASS** condicional — con 1 issue **MINOR** de calidad (`@/*` alias no usado en 3 archivos).

**Recomendación Fely:** aprobar el cierre del story 1.1, y registrar el issue #1 como **debt follow-up** que la story 1.2 (schema + seed + más repos) debe resolver **antes** de añadir más concretos (para que el patrón quede establecido desde el segundo repo, no del quinto).

---

## User Decision (Fely QA)

- **Issue #1:** Aceptado arreglar ahora. Julian refactoriza los 3 archivos + actualiza `tsconfig.json`, `astro.config.mjs`, `vitest.config.ts` con el alias `@db/*`.

---

## Phase 4.5 — Julian — Fix (Issue #1)

### Cambios aplicados

| Archivo | Cambio |
|---|---|
| `tsconfig.json` | Añadido `"@db/*": ["./db/*"]` a `paths`. |
| `astro.config.mjs` | Añadido `alias '@db'` apuntando a `./db`. |
| `vitest.config.ts` | Añadido `alias '@db'` apuntando a `./db`. |
| `src/lib/db/client.ts` | `'../../../db/schema'` → `'@db/schema'`. |
| `src/lib/contexts/.../domain/profile.repository.ts` | `'../../../../../db/schema'` → `'@db/schema'`. |
| `src/lib/contexts/.../infrastructure/sqlite/sqlite-profile.repository.ts` | `'../../../../../../db/schema'` → `'@db/schema'`; `'../../domain/profile.repository'` → `'@/lib/contexts/workout-tracking/domain/profile.repository'`. |
| `tests/db/client.test.ts` | `'../../db/schema'` → `'@db/schema'`. |
| `tests/workout-tracking/sqlite-profile.repository.test.ts` | `'../../db/schema'` → `'@db/schema'`; los otros 2 imports a `@/lib/contexts/...`. |

### Verificación post-fix

- `grep -r "from ['\"]\\.\\." src/ tests/` → **0 matches** (cero imports relativos).
- `npm run typecheck` → **15 files, 0 errors, 0 warnings, 0 hints**.
- `npm run test:run` → **18/18 passing, 4 files**.
- `npm run dev` → `GET /` → **HTTP 200**, `<h1>Gym Up</h1>` ✓, `data-testid="storage-backend"` ✓, valor `sqlite` ✓.

### Status
**Issue #1 fixed. No regression. Ready for Fely re-review.**

---

## Fely — Re-Review (after Issue #1 fix)

### Verdict
**PASS** — issue #1 resuelto, no regresiones, todo lo de la review anterior sigue verde.

### Re-spec compliance
- AC-1.1-01 → 08: **YES** (8/8). Sin cambios funcionales, solo refactor de imports.
- Pattern compliance: **ADR-010 ahora fully aligned** — los 3 archivos usan `@/lib/contexts/...` exactamente como la ADR-010 describe.
- Anti-pattern check (Best Practices imports): **PASS** — cero imports relativos en `src/` y `tests/`.

### Known Bugs Cleanup
- 0 archivos `known-bugs.md`. Nada que limpiar.

### Conclusión
**"Dale go mi pana, estamos ready, ahora arreglate conmigo fuera de la terminal"** — Story 1.1 cerrada. Handoff a Phase 5 (Fely Learning & Growth).

---

## Phase 5 — Fely — Session Learnings

### Reflexión (Stage 2)

Reviso toda la sesión y destilo solo **reglas que cambien decisiones futuras**, no outcomes:

1. **Astro SSR no inyecta `.env` en `process.env` para módulos fuera de `src/`.**
   - **Por qué pasó:** `db/client.ts` lee `process.env.DATABASE_URL`, pero Astro/Vite solo inyecta `import.meta.env.*` para módulos SSR; los imports relativos a `db/` están fuera del contexto de Vite SSR.
   - **Regla:** Cuando un módulo fuera de `src/` (ej. `db/`, `scripts/`) necesita env vars, **cargar `.env` explícitamente** o usar `import.meta.env` con cuidado. El patrón minimalista "leer `.env` con `node:fs`" funciona en tests + dev + Vercel sin dependencia extra.

2. **Story specs pueden contradecir ADRs (e.g. `src/lib/composition/...` vs `src/lib/contexts/.../...composition.ts`).**
   - **Por qué pasó:** La story 1.1 decía "e.g. `src/lib/composition/workout.ts`" (ejemplo ilustrativo), pero la ADR-010 (aceptada) ya definía el path canónico. Sin una round de Alefrank, habríamos seguido el path de la story y luego la ADR-010 habría sido ignorada.
   - **Regla:** Cuando una story referencia una ADR, **la ADR gana sobre el ejemplo de la story**. Phase 1.5 (Alefrank Alignment) debe siempre comparar paths literales contra la ADR referenciada, no contra el ejemplo de la story.

3. **Tests escritos con cache de módulos rompen cuando el env cambia entre tests.**
   - **Por qué pasó:** `vi.resetModules()` no estaba en el primer cut; los tests `composition.test.ts` veían siempre el `STORAGE_BACKEND` del primer import.
   - **Regla:** Tests que importan módulos basados en `process.env` **deben usar `vi.resetModules()` antes de cada import** o el test se vuelve flaky / spuriously green.

4. **`@ts-expect-error` debe ir en la línea exacta que rompe, no en líneas anteriores.**
   - **Por qué pasó:** El compiler TS reporta la línea del campo problemático (`routineType: 'invalid'`), no la línea de la declaración. Poner el directive en la línea de la declaración es "unused directive".
   - **Regla:** Colocar `@ts-expect-error` en la **misma línea** del campo/expresión que rompe. Si la línea siguiente es la del error, mover el directive ahí.

5. **Self-QA puede pasar 13 checks y aún dejar un code smell importante (imports relativos).**
   - **Por qué pasó:** Las 4 categorías de `qa-anti-patterns.md` declaradas en Phase 0 no incluyen "imports relativos"; el golden rule "Best Practices" sí, pero no fue escaneado en self-QA.
   - **Regla:** **Self-QA debe incluir al menos un check de "Best Practices"** (golden-rules.md) además de las categorías de `qa-anti-patterns.md`. Específicamente: imports deben usar los aliases configurados, no paths relativos `..` cuando hay `@/` o `@db/`.

6. **Story 1.2 (siguiente) añadirá ~5 repos. Si el smell de imports relativos no se corrige ahora, se propaga.**
   - **Por qué importa:** Issue #1 era MINOR en 1.1 (3 archivos), pero 1.2 lo amplificaría a 8 archivos. Catch it early.
   - **Regla:** Al añadir el segundo `SqliteXxxRepository` en una story futura, **el primer repo debe usar `@/` consistentemente** (smell propagado = precondición de re-QA).

7. **`@db/*` es un alias útil cuando el schema vive en `db/` (fuera de `src/`).**
   - **Por qué importa:** Drizzle + Astro + tests pueden vivir en tres "mundos" (`src/`, `db/`, `tests/`). Tener un alias dedicado para `db/` evita `../../../db/schema` y deja claro que el schema es cross-cutting.
   - **Regla:** Cuando se añade un directorio de schema (Drizzle, Prisma, JSON contracts) fuera de `src/`, **crear un alias dedicado en `tsconfig.paths` + Vite + Vitest** (ej. `@db/*`, `@contracts/*`). No abusar de `@/*` que apunta solo a `src/`.

### Distilled Rules (Stage 3)

Solo las que **cambian decisiones futuras**:

| # | Regla (trigger → action → reason) | Scope | Destino | Confidence |
|---|-----------------------------------|-------|---------|-----------|
| 1 | **before importing env in modules outside `src/` → load `.env` explicitly with `node:fs` OR use `import.meta.env`** — reason: Astro/Vite only inject `import.meta.env.*` for modules under `src/`; bare `process.env` will be empty and fail with "DATABASE_URL is not set" at runtime | project | `.crew/crew-learnings.md` (quarantine, project) | 1 |
| 2 | **when a story says "e.g. X" and references an ADR → the ADR wins** — reason: "e.g." is illustrative, ADR is source of truth. Cross-check literal paths in Phase 1.5. | skill | `phase-1-5-alignment-loop.md` (integrated inline) | 1 |
| 3 | **when a test imports a module that reads `process.env` at top-level → call `vi.resetModules()` before each import** — reason: ESM caches the module; env changes between tests are silently ignored. | skill | `golden-rules.md` → Test Fixtures section | 1 |
| 4 | **`@ts-expect-error` must sit on the exact line that breaks** — reason: TS reports the error on the offending line, not the declaration. Misplaced directives become "unused" and the test loses its signal. | skill | `golden-rules.md` → Test Fixtures section | 1 |
| 5 | **self-QA must scan `golden-rules.md` "Best Practices" in addition to `qa-anti-patterns.md`** — reason: anti-pattern categories miss style/convention drift (e.g. relative imports vs `@/*`). Self-QA scope gap was caught by Fely this session. | skill | `phase-3-julian-implement.md` → Step 2e instructions | 1 |
| 6 | **when adding the second concrete of a pattern (e.g. second `SqliteXxxRepository`) → the first MUST use the configured aliases (`@/`, `@db/`) consistently** — reason: 1.2 will add ~5 repos; smell from 1.1 (3 files) would have amplified to 8. | project | `.crew/crew-learnings.md` (quarantine, project) | 1 |
| 7 | **when a schema directory lives outside `src/` (Drizzle, Prisma, contracts) → create a dedicated alias (`@db/*`, `@contracts/*`) in `tsconfig.paths` + Vite + Vitest** — reason: avoids `../../../../db/schema` and makes the cross-cutting nature of the schema explicit. | skill | `golden-rules.md` → Best Practices section | 1 |

### Reinforced / Contradicted

- **golden-rules "Best Practices"** — reinforced. La regla existente "predictable glob paths" no era lo suficientemente específica. La regla #7 destilada la vuelve accionable.
- **golden-rules "Test Fixtures"** — reinforced. La regla existente cubre el caso de fixtures desactualizados; las reglas #3 y #4 extienden a "test setup correcto (module cache) y directiva `@ts-expect-error` en la línea exacta".
- **qa-anti-patterns (todas las categorías)** — no contradichas, pero se confirma que **no son suficientes para cubrir convenciones de estilo / paths**. La regla #5 añade el check de `golden-rules.md` al self-QA.

### Documentation Gaps Found

1. **`loadDotEnvIfPresent()` en `db/client.ts`** — el comment explica el por qué, pero no documenta que `db/`, `scripts/`, etc. (fuera de `src/`) requieren este loader. **Recomendación:** mover el loader a `src/lib/env/load-dot-env.ts` y documentar en `docs/architecture/...` que cualquier módulo cross-cutting que lee env vars debe llamarlo. **Decisión:** dejar para una story futura de "arquitectura" (no es bloqueante de 1.1).

### Quarantine Hygiene

- **Graduations:** ninguna (rules #1–7 son nuevas, single-confirmation).
- **Decays:** N/A (cuarentena vacía antes de esta sesión).
- **Re-scopes:** N/A.

---

## User Decision (Phase 5)

(A la espera de aprobación para persistir las 7 reglas destiladas en sus destinos: 2 a project quarantine, 5 a skill — 3 inline + 2 a golden-rules.md.)
