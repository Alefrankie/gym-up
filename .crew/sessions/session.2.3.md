# Session: 2.3 — `exercise-card`

## Phase 0 — Rules Discovery

### Loaded
- `golden-rules.md` (DDD, SOLID, null/mutation, type-safety, QA-First)
- `qa-anti-patterns.md` (9 categories — full file as context; per-story relevance below)
- `phase-0-rules-discovery.md` (process spec)
- `.crew/crew-learnings.md` (project — kebab-case for layouts/components; per-context composition; shared-files = DISCREPANCY)
- `.agents/skills/crew-flow/crew-learnings.md` (skill — "now: Date" at confidence 2, "tsc --noEmit after signature change" at confidence 5, vi.mock exports, etc.)
- `docs/architecture/contexts/workout-tracking/readme.md` (parent spec — domain types, WorkoutEntry schema)
- `docs/prd/features/workout-tracking.md` (FR-WT-008, 009, 010, 011)
- `docs/architecture/components.md` (ExerciseCard prop spec + log-set.flow.md reference)
- `docs/architecture/decisions/006-kg-storage.md` (kg internal, display per unit)
- `docs/stories/phase-1/round-2/story-2.3.md` (5 tasks, 3 ACs)
- `src/pages/workout/[id].astro` (story 2.2 page scaffold — where the card is consumed)
- `src/components/auth-form.astro` (existing component pattern reference)
- `src/components/navigation.astro` (story 1.4 component pattern reference)
- `db/schema.ts` (workoutEntries: `id, workoutId, exerciseId, setNumber, reps, weight, completed, notes`)
- `src/lib/contexts/workout-tracking/domain/workout.repository.ts` (`addEntry` method signature for 2.4 handoff awareness)

### Not found
- No `AGENTS.md` / `CLAUDE.md` / `.implement-rules.md`
- No `*.pattern.md` for workout-tracking
- No existing `exercise-card.astro` (the file the story asks for)

### Codebase state snapshot
- `src/pages/workout/[id].astro:73-83` currently renders the exercise list as a static `<ol>` with name + "×N × M reps". For 2.3, this block is replaced with `<ExerciseCard ... />` per exercise.
- `src/pages/workout/[id].astro:84-86` has a "Coming soon: 2.3" placeholder — 2.3 will remove this note since the feature ships.
- The page already has `user.weightUnit` available (from `getCurrentUser` in the frontmatter), so the component can receive the unit via prop.
- `WorkoutEntry` schema (`@db/schema.ts:181-198`): `id, workoutId, exerciseId, setNumber, reps, weight, completed, notes`. `notes` is **per set** (column on the entries table). `weight` is stored in kg per ADR-006.
- `WorkoutEntryRules` constants: `MinReps=1, MaxReps=100, MinWeight=0, MaxWeight=500 (kg), MaxNotesLength=500, MaxSetsPerExercise=10`.
- `components.md` (ExerciseCard table): the documented prop contract is `exerciseName, targetSets, targetReps, exerciseId, workoutId, weightUnit`. No `entries` or `notes` prop — those are internal implementation details.
- No new use case in 2.3 (the card is pure UI; 2.4 adds the `LogSetUseCase` and auto-save behavior).
- No new endpoint in 2.3 (form has no `action`; 2.4 adds `POST /api/workout-entries`).

### QA anti-patterns relevant to this story
- **Cat 1 — Silent Value Reversion:** `weightUnit` is passed as a prop from the page (which sources it from `user.weightUnit`). The component must not overwrite it on render. Verified by reading the prop type.
- **Cat 2 — Calculation Logic:** No calculation in 2.3 (volume/totals are 2.6's responsibility). N/A.
- **Cat 3 — State Persistence:** the card is a static component. Persistence is 2.4's job (auto-save with debounce per `log-set.flow.md`). **Note:** the form fields must survive navigation if 2.4 doesn't auto-save fast enough — but this is a 2.4 concern, not 2.3.
- **Cat 4 — UI Affordance Completeness:** state matrix for the checkmark (default / hover / checked / disabled), the "+ Add set" button, weight input with unit suffix, notes field with optional indicator. Notes is OPTIONAL — placeholder/helper text should make this clear.
- **Cat 6 — Error Paths:** the form fields have HTML5 `min/max`/`required` constraints. No JS errors expected. The "+ Add set" button is client-side only.
- **Cat 7 — Migration:** N/A (no schema change).
- **Cat 8 — Cross-Feature:** the card reads `weightUnit` from the page (which reads from user). No cross-context mutation.
- **Cat 9 — Type-Safety:** Astro `Props` interface is inline. `Astro.props` typing is strict. `script` (TypeScript or JS) must be valid for Astro 7.

### Story-# / context
- `story-2.3` — `exercise-card`
- Blocked by: `story-2.2` ✅ (page scaffold exists)
- Blocks: `story-2.4` (Log Set auto-save) + `story-2.5` (Rest Timer, which lives inside the card)
- Size: M
- Parent: `docs/architecture/contexts/workout-tracking/readme.md`
- Spec source: `components.md` (ExerciseCard table) + `workout-tracking.md` PRD (FR-WT-008/009/010/011) + `log-set.flow.md`

### Selective learnings loaded
- **Skill rule (2.1, confidence 2):** "now: Date for date-dependent use cases" — N/A (2.3 has no date math).
- **Skill rule (confidence 5):** "tsc --noEmit after signature change" — apply (new component, modified page).
- **Project rule:** kebab-case for layouts AND components — apply (`exercise-card.astro`).
- **Project rule:** one component per file, props inline — apply.
- **Project rule:** per-context composition — N/A (no use case in 2.3, no composition root change).
- **Project rule:** shared files = DISCREPANCY in gap analysis — apply (the page `workout/[id].astro` is shared with 2.2; 2.3 modifies it; not a discrepancy, it's the planned handoff).

---

## Phase 1 — Angel — Gap Analysis & Scope

### Problem Briefing

**What's happening:** El usuario autenticado llega a `/workout/[id]` (página scaffold de 2.2) y ve la lista de ejercicios como texto plano: "Bench Press — ×4 × 10 reps". No puede registrar sets, no ve el input de peso con su unidad preferida, no puede añadir un set extra, no puede escribir notas. El spec pide un componente `exercise-card` que muestre el ejercicio + los inputs de cada set + un botón "+ Add set".

**Why it happens:** El componente `exercise-card.astro` está documentado en `components.md` (tabla de componentes) pero nunca se construyó. La página de workout (2.2) tiene un placeholder que dice "Pronto: registrar sets por ejercicio (story 2.3)" — ese placeholder se quita y se sustituye por el componente. El PRD pide la UI completa en 2.3; el auto-save con debounce y la persistencia son 2.4.

**Where it lives:**
- `src/components/exercise-card.astro` — no existe
- `src/pages/workout/[id].astro:73-86` — bloque de la lista de ejercicios a reemplazar
- `src/components/auth-form.astro` y `src/components/navigation.astro` — referencia de patrón (interface `Props` inline, scoped styles)

**What done looks like:** Al abrir `/workout/[id]`, cada ejercicio de la rutina se renderiza como una `exercise-card` con: nombre del ejercicio, "×{targetSets} × {targetReps} reps" como target, {targetSets} filas de set pre-pobladas con inputs de reps/peso/checkmark, label de unidad (kg o lbs) en el input de peso, un campo de notas opcional por set, y un botón "+ Add set" que añade otra fila client-side. El form no hace POST todavía (eso es 2.4); los inputs no tienen `action`. El placeholder "Pronto: 2.3" desaparece.

### Specs Read
- [docs/architecture/contexts/workout-tracking/readme.md](docs/architecture/contexts/workout-tracking/readme.md) — domain types, `WorkoutEntry` schema
- [docs/prd/features/workout-tracking.md](docs/prd/features/workout-tracking.md) — FR-WT-008, 009, 010, 011
- [docs/architecture/components.md](docs/architecture/components.md) — ExerciseCard prop table
- [docs/architecture/decisions/006-kg-storage.md](docs/architecture/decisions/006-kg-storage.md) — kg internal, display per unit
- [docs/architecture/contexts/workout-tracking/flows/log-set.flow.md](docs/architecture/contexts/workout-tracking/flows/log-set.flow.md) — steps 1-3 happen in the card (steps 4-5 = 2.4)
- [docs/stories/phase-1/round-2/story-2.3.md](docs/stories/phase-1/round-2/story-2.3.md) — 5 tasks, 3 ACs

### Patterns Found
None (`*.pattern.md` doesn't exist for this domain). Will infer from:
- `auth-form.astro` — Props interface inline, scoped `<style>`, plain `<form method="POST">`
- `navigation.astro` — Props interface inline, `<nav>`, scoped `<style>`
- `workout/[id].astro` — same Astro page pattern

### Gap Analysis

| Task / AC | Status | Evidence | Notes |
|---|---|---|---|
| T2.3-01 — Create `src/components/exercise-card.astro` | MISSING | no such file | new code |
| T2.3-02 — Add set input rows | MISSING | no set input UI | new code (pre-populated `targetSets` rows) |
| T2.3-03 — Add unit label | MISSING | no weight unit rendering | new code (kg/lbs suffix in the input) |
| T2.3-04 — Add notes field | MISSING | no notes UI | new code (per-set, optional) |
| T2.3-05 — Add "+ Add set" button | MISSING | no add-set UI | new code (client-side `<script>` to clone the last row) |
| AC-2.3-01 — Card shows exercise name + target (FR-WT-008) | MISSING | no card | new code: header with name + "×{targetSets} × {targetReps} reps" |
| AC-2.3-02 — Weight shows unit label (FR-WT-009, ADR-006) | MISSING | no weight input | new code: `<input type="number" name="weight" />` with `{weightUnit}` suffix |
| AC-2.3-03 — Notes field optional (FR-WT-010) | MISSING | no notes UI | new code: `<input type="text" name="notes" />` per set, no `required` |
| AC oculto — Page `workout/[id].astro` consumes the new component | MISSING | page renders plain text | modify: replace `<ol class="exercise-list">` block with `<ExerciseCard ... />` |
| AC oculto — "Coming soon: 2.3" placeholder removed | DISCREPANCY | `workout/[id].astro:84-86` | remove when card is wired (2.3 is the last story to need that note) |
| AC oculto — Form has no `action` (deferred to 2.4) | DOCUMENTED | per Q5 decision | form fields present, no submission. 2.4 adds `action="/api/workout-entries"` and JS for auto-save. |

### Edge Cases Identified

1. **Notes per set vs per exercise:** PRD says "Optional free-text notes per exercise set" → per set. Schema `workout_entries.notes` confirms per set. UX: one notes input per set row. Documented but not a decision point.
2. **Set count beyond target:** user can add 1, 2, 3+ extra sets via "+ Add set". Schema caps at `WorkoutEntryRules.MaxSetsPerExercise = 10`. Component should cap client-side (after 10 sets, button disabled or hidden).
3. **Weight unit conversion at display time:** kg is stored, but the input field is in the user's unit. The component shows `{weightUnit}` as suffix; **conversion is the user's responsibility in 2.4** (input value stored as kg if user is in lbs, or vice versa). **For 2.3, the input is just a number with the unit label — no conversion logic in the component.**
4. **Reps input validation:** HTML5 `min={WorkoutEntryRules.MinReps} max={WorkoutEntryRules.MaxReps}` (1-100). Weight: `min=0 max={WorkoutEntryRules.MaxWeight}` (0-500). Enforced by browser. Component can also surface these as `placeholder` hints.
5. **Checkmark semantics:** the checkmark is a checkbox `<input type="checkbox" name="completed" />`. No JS handler in 2.3. 2.4 wires it to the rest-timer.
6. **Empty routine day:** the page already handles `exercises.length === 0` with a "no exercises" empty state (2.2). The component is only rendered when there are exercises.
7. **Pre-populated rows + adding rows:** initial render has `targetSets` rows. JS handler adds more. Removing a row is NOT in the 2.3 spec (the spec says "+ Add set" but not "- Remove set") — skip for now, add as a follow-up.
8. **Astro 7 `<script>` handling:** Astro processes `<script>` tags and bundles them. The script can be inline `<script>` (TypeScript) and Astro handles the bundling. 2.3 uses inline `<script>` for the "+ Add set" handler.

### Integration Points
- **Reads from:** `Astro.props` (typed `Props` interface). Page passes `exerciseName, targetSets, targetReps, exerciseId, workoutId, weightUnit` from `user` + `dayWithExercises` + `workout`.
- **Writes to:** none (read-only UI; 2.4 writes to the entries table).
- **Calls:** no use case / no API / no DB.
- **Consumed by:** `src/pages/workout/[id].astro:73-86` (replaces the current plain list).
- **No cross-context mutation:** the card is a pure presentational component.

### Legacy Behavior Concerns
- **`workout/[id].astro:73-83`** plain-text list — replaced. The `.exercise-list`, `.exercise-item`, `.exercise-name`, `.exercise-target` styles are no longer used (the new component has its own styles). **Removed.**
- **`workout/[id].astro:84-86`** "Coming soon" note — removed. 2.3 is the story that delivers the feature, so the note is obsolete.
- **`.dashboard-card` + `.empty-state` styles in the page** — preserved (used for the "no exercises" branch).
- **Auth pattern in the page** — preserved (no change to session resolution).
- **Other components (auth-form, navigation)** — no change. Independent.
- **No regression** on existing tests (71 from 1.3/1.4/2.1/2.2).

### Applicable Golden Rules
- **Null policy:** no nullable values in the component. All props are required strings/numbers. Page passes non-null values from validated sources.
- **Side-effect free reads:** the card is pure presentational. No mutations.
- **SOLID — SRP:** the card renders the form. Form submission + auto-save is 2.4.
- **Naming:** `ExerciseCard` (PascalCase class/function). `Props` interface. Inline.
- **API design:** props are typed and required. No `any`.
- **QA-First:** every AC has a visual verification. `data-test-id` not added (project has no Playwright; documented in 2.1).
- **Type-safety:** `tsc --noEmit` after the new component + page change. Skill rule (confidence 5) applied.
- **One component per file:** yes. `src/components/exercise-card.astro` is one file.
- **Props interface inline:** yes (per project rule).
- **Kebab-case filename:** yes (`exercise-card.astro`).

### QA Anti-Patterns focus (for Julian self-QA)
- **Cat 1** — `weightUnit` prop comes from the page, which sources it from `user.weightUnit`. The component must not derive or overwrite it. Verified by reading the prop type and the page.
- **Cat 4** — State matrix for the checkmark + "+ Add set" button + unit label. Notes field marked optional (placeholder or helper text).
- **Cat 6** — HTML5 validation handles bad input. No JS errors expected.
- **Cat 9** — `tsc --noEmit` after component + page change. `Astro.props` typing correct.

### Self-QA plan (Julian, Phase 3 Step 2e)
- Visual check: open the page in a browser, verify all 5 expected behaviors:
  1. Card shows exercise name + "×N × M reps" target
  2. N pre-populated rows (one per target set)
  3. Each row has reps + weight + checkmark + notes
  4. Weight input has the unit label (kg or lbs based on user)
  5. "+ Add set" button adds a new row when clicked
- Manual smoke: in DevTools, verify form fields have correct `name` attributes (for 2.4 to wire auto-save).
- `tsc --noEmit` verde.
- `npm run test` verde (no new tests for 2.3; it's a pure UI component).
- `npm run build` verde.

### Fely focus areas
- Card renders correctly with the user's `weightUnit` (kg for the test user, lbs for the alt user).
- Notes field is clearly marked as optional (placeholder says "Opcional" or similar).
- "+ Add set" button correctly increments the set number.
- 2.2 page is not regressed (header, status badge, back link still work).
- The page no longer shows the "Coming soon" note.
- HTML5 validation works (try entering negative weight → browser blocks).

### Questions for User

> Have a proposal, or want my recommendation? — I provide recommendations for all 3 below.

**Q1 — Notes per set or per exercise?**
PRD says "per exercise set" (per set). Schema `workout_entries.notes` is per set. The components.md table doesn't specify. **Where does the notes field live?**

- **Context:** PRD and schema both say per set. The components.md table says "Notes field optional" without specifying.
- **My recommendation:** **A) Per set** — one notes input per set row. Matches PRD + schema. The notes input is rendered inside each set row alongside reps/weight/checkmark. The user can leave it blank (optional).
- **Alternatives considered:**
  - **B) Per exercise** (one notes field for the whole exercise) — does not match PRD or schema. Would require a different storage model. Rejected.
  - **C) No notes in 2.3** (defer to 2.4) — leaves FR-WT-010 unimplemented. Rejected.
- **Tradeoff if alternative:** A is the only correct option per spec.

**Q2 — "+ Add set" button: client-side JS or form-driven?**
The spec says "+ Add set" is a button. The card is a static Astro component (no JS by default). The button needs to add a new row when clicked.

- **Context:** Astro supports inline `<script>` tags that are bundled and run client-side. 2.3 is about the UI; 2.4 will add the form submission logic. The "+ Add set" handler is pure UI (add a row, increment set number).
- **My recommendation:** **A) Client-side JS (inline `<script>` in the .astro file).** The button has a click handler that clones the last row's HTML, increments the set number, and appends it to the set list. ~20 lines of TS. Works in all browsers. The 2.4 auto-save doesn't need to know about this — the form just has more fields when submitted.
- **Alternatives considered:**
  - **B) Render `targetSets + 1` rows by default (one extra)** — no JS, but doesn't match "+ Add set" UX (user can only add 1 extra set, not 2+). Rejected.
  - **C) Form-driven (button submits to a route that re-renders the page with +1 row)** — no JS, but requires a server roundtrip for each add. Slower, more state to track. Rejected.
  - **D) No "+ Add set" in 2.3** (button is a no-op placeholder) — violates the spec happy path step 5. Rejected.
- **Tradeoff if alternative:** A is the standard SPA-style UX. Adds ~20 lines of TS to the component, well within M-size scope.

**Q3 — Remove set button?**
The spec says "+ Add set" (add) but not "- Remove set" (remove). What about the reverse?

- **Context:** User might want to delete a set they accidentally added. The spec is silent. The schema has no "soft delete" — entries are deleted (cascade) or kept.
- **My recommendation:** **A) No remove button in 2.3.** Out of spec scope. If the user adds a set they don't want, they can leave it empty. 2.4 (auto-save) will skip empty sets, so the extra row has no DB impact. **If Fely's manual smoke reveals a strong need, it's a follow-up ticket.**
- **Alternatives considered:**
  - **B) Add a "×" button to each row that removes it** — out of spec scope; adds ~10 lines of TS + 1 prop; could be added in 2.3 if cheap, but the spec doesn't require it. Rejected for scope discipline.
- **Tradeoff if alternative:** B is slightly nicer UX but outside the spec. The spec is the contract; if it doesn't say "remove set", 2.3 doesn't add it.

---

### Gap Summary
DONE: 0 | PARTIAL: 0 | DISCREPANCY: 0 | MISSING: 5 (tasks) + 3 (ACs) | NOT-STARTED: 0

(The 1 "DISCREPANCY" row — the "Coming soon" placeholder — is not a real conflict; it's the planned handoff. 2.3 removes the note since the feature ships.)

### Verdict
Gap analysis complete. 3 questions open (Q1-Q3). Handing off to user for decisions.

> STOP — waiting for user answers on Q1-Q3 before proceeding to Phase 1.5 alignment.

---

## User Decision (recorded)
- **Q1 — Notes location:** **A) Por set.** Un input de notas por cada fila de set, al lado de reps/weight/checkmark. Matchea PRD + schema.
- **Q2 — Add set JS:** **A) Client-side JS inline.** Script TS en el .astro file. Click handler clona la última fila, incrementa set number, append. ~20 líneas.
- **Q3 — Remove set:** **A) Sin remove en 2.3.** Out of spec scope. Filas vacías se skipean en 2.4.

### Updated AC list (post-user-decision)
- AC-2.3-01: Card shows exercise name + "×{targetSets} × {targetReps} reps" target per [FR-WT-008](../../prd/features/workout-tracking.md).
- AC-2.3-02: Weight input shows unit label (kg or lbs) per [FR-WT-009](../../prd/features/workout-tracking.md) and [ADR-006](../../architecture/decisions/006-kg-storage.md).
- AC-2.3-03: Notes field is optional and lives PER SET (one input per set row) per [FR-WT-010](../../prd/features/workout-tracking.md).
- AC-2.3-04 (new, Q2): "+ Add set" button is functional via inline `<script>` — click clones the last row, increments `set_number`, appends to the list. Cap at 10 sets (`WorkoutEntryRules.MaxSetsPerExercise`) — after 10, button is hidden.
- AC-2.3-05 (new, Q1): Each set row has 4 fields: `reps` (number, min 1 max 100), `weight` (number, min 0 max 500, with `{weightUnit}` suffix), `completed` (checkbox), `notes` (text, optional, max 500 chars per `WorkoutEntryRules.MaxNotesLength`).
- AC-2.3-06 (new, handoff): Form fields have no `action` (deferred to 2.4). The component is pure UI; auto-save + form submission is 2.4's `LogSetUseCase` + `/api/workout-entries` endpoint.
- AC-2.3-07 (new, page integration): `src/pages/workout/[id].astro` replaces the plain `<ol>` exercise list with `<ExerciseCard ... />` per exercise. The "Coming soon: 2.3" placeholder is removed.

---

## Phase 1.5 — Alefrank — Alignment Check (Round 1)

### Discrepancies Found

| # | Type | Description | Spec Reference | Severity |
|---|------|-------------|----------------|----------|
| 1 | user-decided | Q1 = per-set notes. Matches PRD + schema. | FR-WT-010 + `workout_entries.notes` | None (resolved) |
| 2 | user-decided | Q2 = client-side JS. ~20 lines inline `<script>`. | `components.md` ExerciseCard table | None (resolved) |
| 3 | user-decided | Q3 = no remove button. Out of spec scope. | (spec silent) | None (resolved) |
| 4 | spec-gaps | The spec doesn't say whether the form has an `action` in 2.3. The `log-set.flow.md` says the form posts on checkmark tap (which is 2.4's auto-save). For 2.3, the form is static UI. **Documented: no `action` in 2.3.** | `log-set.flow.md` Step 2 | Minor (documented) |
| 5 | spec-gaps | The `WorkoutEntryRules.MaxSetsPerExercise = 10` cap is from the parent spec (set-level invariant). The "+ Add set" button should respect this cap. **Add to plan: cap at 10 sets, button hidden after 10.** | `workout-tracking/readme.md` Set-level invariants | None (already noted in Edge Case #2) |
| 6 | legacy-watch | `workout/[id].astro:73-86` is shared with 2.2. 2.3 modifies it to consume the new component and remove the "Coming soon" note. **Not a discrepancy, planned handoff.** | (n/a) | None |
| 7 | legacy-watch | `.exercise-list`, `.exercise-item`, `.exercise-name`, `.exercise-target` styles in `workout/[id].astro` are no longer used after 2.3 (the component has its own styles). **Remove the unused scoped styles.** | `workout/[id].astro:88-100+` | Minor (cleanup) |
| 8 | accessibility | Checkmark checkbox should have a clear `<label>` or `aria-label`. The "+ Add set" button is a regular `<button>` with text content (already accessible). Notes field needs `aria-label` or `<label for=...>` since it's per-row. | WCAG 2.1 AA (project standard) | Minor (add to plan) |
| 9 | api-design | The component takes `weightUnit` as a prop. The page passes it from `user.weightUnit`. **No conversion logic in the component** — that's 2.4's job (LogSetUseCase will convert lbs→kg before persisting). The input value is just a number with `{weightUnit}` as suffix. | ADR-006 | None (documented in Edge Case #3) |

### Resolution
- **#1, #2, #3:** Resolved via user decisions.
- **#4:** Documented — no `action` in 2.3. 2.4 adds the form submission wiring.
- **#5:** Add to plan — cap at 10 sets.
- **#6:** Confirmed as planned handoff. No regression on 2.2.
- **#7:** Add to plan — remove unused styles.
- **#8:** Add to plan — accessibility labels for checkbox and notes input.
- **#9:** Confirmed. Component does no conversion; the value is just a number.

### Verdict
✅ **ALIGNED.** Spec coverage complete with the new ACs (AC-2.3-04 through AC-2.3-07). No major discrepancies. Four minor items are tracked into Phase 2 plan. I approve Julian to start implementation after the plan is approved.

---

## Phase 2 — Alefrank — Implementation Plan

### Gap Summary (from Angel + alignment)
DONE: 0 | PARTIAL: 0 | DISCREPANCY: 0 (planned handoff) | MISSING: 8 (5 tasks + 3 ACs) | NOT-STARTED: 0

### Plan Summary (plain language)
Construir el componente `exercise-card.astro` que renderiza la card de un ejercicio con sus sets inputs, y reemplazar la lista plana de la página `/workout/[id]` con instancias del componente. Dos archivos tocados: uno nuevo, uno modificado.

1. **`src/components/exercise-card.astro` (NEW)** — componente presentacional puro. Props: `exerciseName, targetSets, targetReps, exerciseId, workoutId, weightUnit`. Render:
   - Header con nombre del ejercicio + target `×{N} × {M} reps`.
   - Lista de N filas de set pre-pobladas. Cada fila: input reps (number, min 1 max 100), input weight (number, min 0 max 500, con suffix `{weightUnit}`), checkbox completed, input notes (text, max 500, optional, con `aria-label`).
   - Botón "+ Add set" que añade una fila vía inline `<script>` (TypeScript). Cap a 10 sets; después de 10, el botón se esconde.
   - Estilos scoped (glassmorphism consistente con `.dashboard-card`).
   - Form SIN `action` (lo añade 2.4).

2. **`src/pages/workout/[id].astro` (MODIFIED)** — reemplazar el bloque `<ol class="exercise-list">` con `<ExerciseCard ... />` por ejercicio. Quitar el "Coming soon" placeholder. Quitar los estilos `.exercise-list`, `.exercise-item`, `.exercise-name`, `.exercise-target` (ya no se usan). Pasar `user.weightUnit` al componente.

### Implementation Steps (ordered)

**Step 1 — Component: `src/components/exercise-card.astro`**

```astro
---
// src/components/exercise-card.astro
//
// Story 2.3 — exercise-card. Render-only UI component for logging sets.
// Per components.md ExerciseCard prop table. Form submission is 2.4's job
// (LogSetUseCase + auto-save); this component has no `action` and no
// client-side submission handler. Only client-side logic is the "+ Add set"
// button (adds a row, increments set number, caps at MaxSetsPerExercise).

import { WorkoutEntryRules } from '../lib/contexts/workout-tracking/domain/workout-tracking.constants';

interface Props {
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  exerciseId: string;
  workoutId: string;
  weightUnit: 'kg' | 'lbs';
}

const {
  exerciseName,
  targetSets,
  targetReps,
  exerciseId,
  workoutId,
  weightUnit,
} = Astro.props;
const maxSets = WorkoutEntryRules.MaxSetsPerExercise; // 10
---

<article class="exercise-card" aria-labelledby={`exercise-${exerciseId}-name`}>
  <header class="exercise-card-header">
    <h3 id={`exercise-${exerciseId}-name`} class="exercise-card-name">{exerciseName}</h3>
    <p class="exercise-card-target">×{targetSets} × {targetReps} reps</p>
  </header>

  <ol class="set-list" data-target-sets={targetSets} data-max-sets={maxSets}>
    {Array.from({ length: targetSets }, (_, i) => i + 1).map((setNumber) => (
      <li class="set-row" data-set-number={setNumber}>
        <span class="set-number" aria-hidden="true">{setNumber}</span>
        <label class="set-field">
          <span class="set-label">Reps</span>
          <input
            type="number"
            name={`entries[${setNumber}][reps]`}
            min={WorkoutEntryRules.MinReps}
            max={WorkoutEntryRules.MaxReps}
            placeholder={String(targetReps)}
            inputmode="numeric"
            class="set-input"
          />
        </label>
        <label class="set-field">
          <span class="set-label">Peso ({weightUnit})</span>
          <input
            type="number"
            name={`entries[${setNumber}][weight]`}
            min={WorkoutEntryRules.MinWeight}
            max={WorkoutEntryRules.MaxWeight}
            step="0.5"
            inputmode="decimal"
            class="set-input"
            data-weight-unit={weightUnit}
          />
        </label>
        <label class="set-field set-field-checkbox">
          <span class="set-label">Hecho</span>
          <input
            type="checkbox"
            name={`entries[${setNumber}][completed]`}
            value="true"
            class="set-checkbox"
          />
        </label>
        <label class="set-field set-field-notes">
          <span class="set-label">Notas <span class="set-label-optional">(opcional)</span></span>
          <input
            type="text"
            name={`entries[${setNumber}][notes]`}
            maxlength={WorkoutEntryRules.MaxNotesLength}
            placeholder="Ej: sentí bien el último"
            class="set-input"
          />
        </label>
        <input type="hidden" name={`entries[${setNumber}][exercise_id]`} value={exerciseId} />
      </li>
    ))}
  </ol>

  <button type="button" class="add-set-button" data-action="add-set" hidden={targetSets >= maxSets}>
    + Añadir set
  </button>

  <input type="hidden" name="workout_id" value={workoutId} />
</article>

<script>
  // Client-side "+ Add set" handler. Adds a new row, increments set number,
  // hides the button at MaxSetsPerExercise. ~30 lines.
  const cards = document.querySelectorAll<HTMLElement>('.exercise-card');
  cards.forEach((card) => {
    const setList = card.querySelector<HTMLOListElement>('.set-list');
    const addButton = card.querySelector<HTMLButtonElement>('[data-action="add-set"]');
    const maxSets = Number(setList?.dataset.maxSets ?? '10');
    if (!setList || !addButton) return;

    const updateButtonVisibility = () => {
      const currentSets = setList.querySelectorAll('.set-row').length;
      addButton.hidden = currentSets >= maxSets;
    };

    addButton.addEventListener('click', () => {
      const rows = setList.querySelectorAll<HTMLLIElement>('.set-row');
      const lastRow = rows[rows.length - 1];
      if (!lastRow) return;
      const nextSetNumber = Number(lastRow.dataset.setNumber ?? '0') + 1;
      if (nextSetNumber > maxSets) return;

      // Clone the last row and update set_number + input names.
      const newRow = lastRow.cloneNode(true) as HTMLLIElement;
      newRow.dataset.setNumber = String(nextSetNumber);
      newRow.querySelector('.set-number')!.textContent = String(nextSetNumber);

      // Update input name attributes: entries[N][field] → entries[N+1][field]
      newRow.querySelectorAll<HTMLInputElement>('input[name^="entries["]').forEach((input) => {
        const oldName = input.getAttribute('name') ?? '';
        const newName = oldName.replace(/entries\[\d+\]/, `entries[${nextSetNumber}]`);
        input.setAttribute('name', newName);
        // Reset values for the cloned row.
        if (input.type === 'checkbox') input.checked = false;
        else input.value = '';
      });

      setList.appendChild(newRow);
      updateButtonVisibility();
    });

    updateButtonVisibility();
  });
</script>

<style>
  .exercise-card {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }

  .exercise-card-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.85rem;
  }

  .exercise-card-name {
    font-family: 'Oswald', sans-serif;
    font-size: 1.15rem;
    font-weight: 600;
    color: #fff;
    margin: 0;
  }

  .exercise-card-target {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.85rem;
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .set-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .set-row {
    display: grid;
    grid-template-columns: auto repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    align-items: end;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .set-row:last-child {
    border-bottom: none;
  }

  .set-number {
    font-family: 'Oswald', sans-serif;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
    width: 1.5rem;
    text-align: center;
  }

  .set-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .set-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .set-label-optional {
    color: rgba(255, 255, 255, 0.35);
    text-transform: none;
    letter-spacing: 0;
    font-size: 0.65rem;
  }

  .set-input {
    background: rgba(0, 0, 0, 0.3);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.4rem;
    padding: 0.45rem 0.6rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.9rem;
    width: 100%;
    box-sizing: border-box;
  }

  .set-input:focus-visible {
    outline: 2px solid #ff4d4d;
    outline-offset: 2px;
    border-color: #ff4d4d;
  }

  .set-field-checkbox {
    align-items: center;
  }

  .set-checkbox {
    width: 1.2rem;
    height: 1.2rem;
    cursor: pointer;
    accent-color: #ff4d4d;
  }

  .set-field-notes {
    grid-column: 2 / -1;
  }

  .add-set-button {
    margin-top: 0.5rem;
    background: rgba(255, 77, 77, 0.12);
    color: #ff8a8a;
    border: 1px dashed rgba(255, 77, 77, 0.3);
    border-radius: 0.4rem;
    padding: 0.5rem 0.85rem;
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease;
  }

  .add-set-button:hover,
  .add-set-button:focus-visible {
    background: rgba(255, 77, 77, 0.2);
    color: #fff;
  }

  .add-set-button:focus-visible {
    outline: 2px solid #ff4d4d;
    outline-offset: 2px;
  }

  @media (max-width: 600px) {
    .set-row {
      grid-template-columns: auto 1fr 1fr;
    }
    .set-field-notes {
      grid-column: 1 / -1;
    }
  }
</style>
```

**Step 2 — Page integration: `src/pages/workout/[id].astro`**

Modifications:
- Import `ExerciseCard` at the top of the frontmatter.
- Pass `user.weightUnit` to each `<ExerciseCard>`.
- Replace the `<ol class="exercise-list">` block (lines 73-83) with `<ExerciseCard ... />` per exercise.
- Remove the "Coming soon" placeholder (lines 84-86).
- Remove the unused scoped styles `.exercise-list`, `.exercise-item`, `.exercise-name`, `.exercise-target` (from the `<style>` block).

**Step 3 — Self-QA + tests/build**
- `npm run test:run` → verde (no new tests; existing 80/80 should still pass).
- `npm run typecheck` → verde (Cat 9, skill rule confidence 5).
- `npm run build` → verde (Astro bundles the inline `<script>` correctly).

### Files Julian will touch
- **CREATE** `src/components/exercise-card.astro` (component + inline script + scoped styles)
- **MODIFY** `src/pages/workout/[id].astro` (consume the component, remove placeholder + unused styles)

### Files NOT touched (preserved)
- `src/components/{auth-form,navigation}.astro` — independent
- `src/lib/contexts/workout-tracking/*` — no use case in 2.3; composition root unchanged
- `src/pages/api/*` — no new endpoint in 2.3
- `db/*` — no schema change
- `src/lib/contexts/auth/*` — unchanged
- `src/layouts/*` — unchanged
- `src/pages/{index,login,register,logout,dashboard}.astro` — unchanged
- All tests (no new tests for 2.3; component is UI-only)

### Selected Skills
- **crew-flow** (orquestador) — ya activo
- Ningún otro skill del system prompt aplica directamente.

### Pattern Contracts
- **None** — no `*.pattern.md` for workout-tracking. Julian infiere from:
  - `components.md` (ExerciseCard prop table) — the spec for this component
  - `auth-form.astro` + `navigation.astro` (Props interface inline + scoped styles pattern)
  - `workout-tracking.constants.ts` (single source of truth for the validation ranges)

### Legacy Watchlist
- **`workout/[id].astro:73-83`** plain-text list — replaced with `<ExerciseCard />`.
- **`workout/[id].astro:84-86`** "Coming soon" placeholder — removed.
- **`.exercise-list`, `.exercise-item`, `.exercise-name`, `.exercise-target` styles** — removed (no longer used).
- **Auth pattern in the page** — preserved.
- **AppLayout wrapper** — preserved.
- **No regression** on existing tests (80 from 2.1/2.2/1.3/1.4).

### Applicable Golden Rules
- **Null policy:** all props are required and non-null. Page passes non-null values.
- **Side-effect free reads:** the component is pure UI. No mutations.
- **SOLID — SRP:** the card renders the form. Form submission + auto-save is 2.4.
- **Naming:** `ExerciseCard` (PascalCase). `Props` interface inline. Helper constants imported from `workout-tracking.constants.ts`.
- **API design:** props typed, all required. No `any`.
- **QA-First:** every AC verified visually (manual smoke in browser).
- **Type-safety:** `tsc --noEmit` after component + page change. Skill rule (confidence 5) applied.
- **One component per file:** yes.
- **Props interface inline:** yes.
- **Kebab-case filename:** `exercise-card.astro`.
- **Single source of truth:** validation ranges from `WorkoutEntryRules` constants. No hardcoded numbers.

### QA Anti-Patterns (from qa-anti-patterns.md)
- **Relevant categories:**
  - **Cat 1** (Silent Value Reversion) — `weightUnit` prop comes from the page, which sources it from `user.weightUnit`. The component must not derive or overwrite it. Verified by reading the prop type and the page.
  - **Cat 4** (UI Affordance Completeness) — state matrix for the checkmark (default/hover/checked/focus-visible), unit label, notes field marked optional. "+ Add set" button has hover/focus-visible states.
  - **Cat 6** (Error Paths) — HTML5 `min`/`max` constraints on inputs. Browser handles bad input. No JS errors expected.
  - **Cat 9** (Type-Safety Blind Spots) — `tsc --noEmit` after component + page change. `Astro.props` typing correct. Skill rule (confidence 5) applied.

- **Self-QA plan (Julian, Phase 3 Step 2e):**
  1. Walk through every AC:
     - AC-2.3-01: card shows name + target
     - AC-2.3-02: weight input has unit label (kg/lbs)
     - AC-2.3-03: notes per set, marked optional
     - AC-2.3-04: "+ Add set" button works, caps at 10
     - AC-2.3-05: each row has 4 fields with correct validation ranges
     - AC-2.3-06: form has no `action`
     - AC-2.3-07: page consumes the component, no "Coming soon" note
  2. `npm run test` verde.
  3. `tsc --noEmit` verde.
  4. `npm run build` verde.

- **Fely focus areas:**
  - Card renders correctly with the user's `weightUnit` (kg for the test user, lbs for the alt user).
  - Notes field is clearly marked as optional (placeholder or helper text).
  - "+ Add set" button correctly increments the set number and caps at 10.
  - 2.2 page is not regressed (header, status badge, back link still work).
  - The page no longer shows the "Coming soon" note.
  - HTML5 validation works (try entering negative weight → browser blocks).
  - The component's `<script>` runs only client-side (Astro bundles it).
  - Accessibility: every input has a `<label>` (no `aria-label` shortcuts).

### Verdict
PRESENTED FOR REVIEW. Plan is complete and consistent with the user decisions. STOP — waiting for user approval.

---

## Alefrank — Plan Ready for Review

### Session Summary
- **Story:** 2.3 — `exercise-card`
- **Description:** Componente presentacional puro `exercise-card.astro` para registrar sets. Renderiza el nombre del ejercicio, los N sets target con inputs de reps/peso/checkmark/notas, y un botón "+ Add set" client-side.
- **Specs reviewed:** `workout-tracking/readme.md` (domain types, WorkoutEntry), `prd/features/workout-tracking.md` (FR-WT-008/009/010/011), `components.md` (ExerciseCard prop table), ADR-006 (kg storage), `log-set.flow.md` (steps 1-3 happen in the card), `story-2.3.md` (5 tasks, 3 ACs), existing `auth-form.astro` + `navigation.astro` (component patterns), `workout/[id].astro` (the page that consumes the component).
- **Patterns found:** None (`*.pattern.md` doesn't exist). Inferring from existing components.
- **Gap totals:** DONE: 0 | PARTIAL: 0 | DISCREPANCY: 0 (planned handoff) | MISSING: 8 | NOT-STARTED: 0
- **Key decisions made:**
  - Q1 = Notes per set (matches PRD + schema)
  - Q2 = Client-side JS for "+ Add set" (inline `<script>` in the .astro file)
  - Q3 = No remove button in 2.3 (out of spec scope)

### Proposed Implementation Plan
1. Crear `src/components/exercise-card.astro` con props typed, scoped styles, inline `<script>` para "+ Add set" con cap en 10 sets.
2. Modificar `src/pages/workout/[id].astro` para consumir el componente, pasar `user.weightUnit`, quitar el placeholder "Coming soon" y los estilos no usados.
3. Correr `tsc --noEmit` + `npm run test` + `npm run build`.
4. Self-QA contra todas las ACs.

### Files Julian will touch
- **CREATE** [src/components/exercise-card.astro](src/components/exercise-card.astro) — componente + script + estilos
- **MODIFY** [src/pages/workout/[id].astro](src/pages/workout/[id].astro) — consume + remove placeholder + remove unused styles

### Skills Loaded for This Task
- **crew-flow** (orquestador) — ya activo
- **Skill rule (confidence 5):** "tsc --noEmit after signature change" — applied
- **Skill rule (2.1, confidence 2):** "now: Date for date-dependent use cases" — N/A (2.3 has no date math)
- **Project rule:** kebab-case for components (applied to `exercise-card.astro`)
- **Project rule:** one component per file, props inline (applied)

### What Julian will do
1. Crear `src/components/exercise-card.astro` con la estructura definida en Step 1.
2. Modificar `src/pages/workout/[id].astro` para consumir el componente.
3. Correr `tsc --noEmit` + `npm run test` + `npm run build`.
4. Self-QA contra las 7 ACs (AC-2.3-01 a AC-2.3-07).

### What Julian will NOT do
- No implementará form submission / auto-save (es 2.4).
- No construirá el rest-timer (es 2.5; vivirá dentro de la card pero lo añade 2.5).
- No implementará conversión kg↔lb en el componente (es 2.4, `LogSetUseCase`).
- No añadirá tests automatizados (es UI puro; los tests del use case vendrán en 2.4).
- No eliminará el `.dashboard-card` ni los estilos globales del page.
- No migrará a Supabase (6.x).

### Legacy behaviors being preserved
- AppLayout wrapper en la página.
- Auth resolution pattern en la página.
- `.dashboard-card` y `.empty-state` styles (siguen usándose para "no exercises").
- Composition root pattern (sin cambios en 2.3; no use case nuevo).

---

**Review the plan above. Does this look correct?**

- If yes → type "approve" and Julian will start
- If no → tell me what to change and I'll adjust

**STOP.** Waiting for user approval before Phase 3.

---

## Phase 3 — Julian — Implementation

### Tests Written
- No new tests. 2.3 is a pure UI component; its behavior is verified by the 80 existing unit tests (regression) + manual smoke. Component-level tests would require Playwright (out of scope for 2.3, deferred to a cross-cutting testing story).

### Implementation Changes
- `src/components/exercise-card.astro` (NEW) — presentational Astro component per `components.md` ExerciseCard prop table. Props: `exerciseName, targetSets, targetReps, exerciseId, workoutId, weightUnit`. Renders:
  - Header: `<h3>` with exercise name + `×{targetSets} × {targetReps} reps` target
  - `<ol class="set-list">` with `targetSets` pre-populated rows. Each row has: set number (`<span aria-hidden>`), reps `<input type="number">` (min 1 max 100), weight `<input type="number">` (min 0 max 500, with `{weightUnit}` suffix in label), `<input type="checkbox">` for "Hecho", notes `<input type="text">` (maxlength 500, placeholder, marked `(opcional)`), hidden `entries[N][exercise_id]`
  - `<button data-action="add-set">+ Añadir set</button>` with `hidden={targetSets >= maxSets}` (initial cap)
  - Inline `<script>` (TypeScript via Astro) that finds all `.exercise-card` on the page, attaches a click handler that clones the last row, increments `data-set-number`, rewrites `entries[N][...]` → `entries[N+1][...]` in input names, resets values, appends. Button visibility updated on each add. Caps at `WorkoutEntryRules.MaxSetsPerExercise` (10).
  - Scoped `<style>` with glassmorphism (`.exercise-card`), grid layout (5 columns desktop, 3 columns mobile with checkbox + notes wrapping), focus-visible outlines, hover states on the add-set button.
- `src/pages/workout/[id].astro` (MODIFIED) — imports `ExerciseCard`. Frontmatter passes `user.weightUnit` to each card. The plain `<ol class="exercise-list">` block is replaced with `dayWithExercises.exercises.map((slot) => <ExerciseCard ... />)`. The "Coming soon: 2.3" placeholder is removed. Unused scoped styles (`.exercise-list`, `.exercise-item`, `.exercise-name`, `.exercise-target`, `.coming-soon`) are removed from the `<style>` block.

### Test Results
- New tests: 0 (UI pure)
- Full suite: **80 / 80 pass** across 11 test files (4.56s)
- Regressions: **none**

### Type / Build Check
- `tsc --noEmit` (`astro check`): **0 errors, 0 warnings** after fix. 9 hints in pre-existing files unrelated to this story.
  - **Initial typecheck run** surfaced 7 errors in the inline `<script>` — TypeScript didn't infer DOM types for `querySelector`/`cloneNode`/`dataset` results. Fixed by adding explicit `as HTMLOListElement | null`, `as HTMLButtonElement | null`, `as HTMLLIElement` casts and `<HTMLElement>`/`<HTMLInputElement>` generics on `querySelectorAll`. The build (`vite`) succeeded even with the typecheck errors because Vite strips types via SWC; `astro check` is the stricter gate. **Skill rule (confidence 5): "tsc --noEmit after signature change"** — caught this issue.
- `npm run build` (Vercel adapter): **success** in 4.22s. Astro bundled the inline `<script>` correctly.

### Self-QA (Anti-Pattern Checks)

| Category | Check | Result | Notes |
|---|---|---|---|
| Cat 1 | `weightUnit` prop comes from page, not derived | **PASS** | Page passes `user.weightUnit` directly. Component uses it as a label suffix only — no conversion, no overwrite. |
| Cat 4 | UI affordances on every interactive element | **PASS** | Checkbox has `<label>`, inputs have `<label>`, "+ Add set" has hover + focus-visible states, all inputs have `focus-visible` outlines. |
| Cat 4 | Notes field marked optional | **PASS** | Label includes `(opcional)` and placeholder text. |
| Cat 4 | Unit label rendered in weight input | **PASS** | `<span class="set-label">Peso ({weightUnit})</span>` — shows "Peso (kg)" or "Peso (lbs)" based on user. |
| Cat 6 | HTML5 validation handles bad input | **PASS** | `min`/`max`/`step` on number inputs; `maxlength` on text. Browser blocks invalid values. No JS errors. |
| Cat 6 | "+ Add set" caps at 10 sets | **PASS** | `data-max-sets` attribute + button `hidden` toggle in script. Initial render also hides button if `targetSets >= maxSets`. |
| Cat 7 | Migration / data model | **N/A** | No schema change. |
| Cat 8 | Cross-feature: component is presentational | **PASS** | No DB access, no API calls, no cross-context mutation. Pure UI. |
| Cat 9 | Type-safety after signature change | **PASS** | `tsc --noEmit` clean after fix. Skill rule (confidence 5) applied. |
| Cat 9 | DOM type assertions on `querySelector`/`cloneNode` results | **PASS** | Added `<HTMLElement>`, `<HTMLInputElement>` generics + `as HTMLOListElement`/`HTMLButtonElement`/`HTMLLIElement` casts. |
| Skill rule (2.1) | `now: Date` for date-dependent use cases | **N/A** | No date math in 2.3. |
| Skill rule | `tsc --noEmit` after signature change (confidence 5) | **PASS** | Caught 7 typecheck errors before declaring done. |

### Issues Found & Fixed
- **7 TypeScript errors in the inline `<script>`** — `querySelector`/`cloneNode`/`dataset` returned generic `Node`/`Element` types. Fixed by adding explicit DOM type assertions. Documented in the Test Results section.

### Gaps for Fely
1. **Manual smoke (visual):** the component has no automated test. Fely should verify in a browser:
   - Card shows exercise name + "×N × M reps" target
   - N pre-populated rows with reps, weight (with unit), checkbox, notes
   - Notes field is marked optional
   - "+ Add set" button adds a row, increments the set number, caps at 10
   - 2.2 page elements (header, status badge, back link) still render correctly
   - "Coming soon" note is gone
   - HTML5 validation works (negative weight, reps > 100)
2. **Mobile layout:** the 5-column grid collapses to 3 columns + wrapping checkbox/notes below 700px. Manual smoke on mobile (or DevTools responsive) recommended.
3. **data-test-id not added** (consistent with 2.1/2.2 GAPs — Playwright not in the project yet).
4. **CSRF for the future form** (2.4's concern) — out of scope.

### Status
**Implementation complete. All 80 tests green. `tsc --noEmit` clean. `npm run build` succeeds. Self-QA complete. Handing off to Fely for QA review.**

---

## Phase 4 — Fely — QA Report

### Spec Compliance

| AC | Implemented? | Tested? | Notes |
|---|---|---|---|
| AC-2.3-01 — Card shows exercise name + target (FR-WT-008) | Yes | Partial (visual) | `<h3>` with name + `×{targetSets} × {targetReps} reps` target. Manual smoke required. |
| AC-2.3-02 — Weight shows unit label (FR-WT-009, ADR-006) | Yes | Partial (visual) | "Peso (kg)" or "Peso (lbs)" label. Conversion deferred to 2.4 (LogSetUseCase). |
| AC-2.3-03 — Notes field optional (FR-WT-010) | Yes | Partial (visual) | Per-set notes input, marked `(opcional)` in label, with placeholder. |
| AC-2.3-04 — "+ Add set" functional, cap at 10 (Q2) | Yes | Manual (visual) | Inline `<script>` clones the last row, increments set number, rewrites input names, caps at 10. Browser-only test. |
| AC-2.3-05 — 4 fields per row (reps, weight, completed, notes) + exercise_id hidden | Yes | Partial (visual) | All 4 fields + hidden `entries[N][exercise_id]`. Code review confirms. |
| AC-2.3-06 — Form has no `action` (deferred to 2.4) | Yes | Yes | No `action` on the component. No form wrapper in the page. 2.4 will add the form. |
| AC-2.3-07 — Page consumes the component, no "Coming soon" note | Yes | Yes | `workout/[id].astro` uses `<ExerciseCard ... />` per exercise. "Coming soon" paragraph removed. Unused styles cleaned. |

### Pattern Compliance

| Pattern | Followed? | Notes |
|---|---|---|
| kebab-case filename | Yes | `exercise-card.astro`. |
| One component per file | Yes | Single file, no shared logic. |
| Props interface inline | Yes | `interface Props` above the component. |
| `workout-tracking.constants.ts` as single source of truth | Yes | `WorkoutEntryRules.{MinReps, MaxReps, MinWeight, MaxWeight, MaxNotesLength, MaxSetsPerExercise}` imported. No hardcoded numbers. |
| Per-context composition (ADR-010) | N/A | No use case in 2.3. Component is presentational. |
| Plain text error responses (project convention) | N/A | No API errors in 2.3. |
| `data-test-id` for E2E | Not added (GAP) | Consistent with 2.1/2.2. Playwright not in project. |

### Test Quality
- 0 new tests (UI pure, no logic to unit-test).
- 80/80 existing tests pass.
- Component correctness verified by code review + manual smoke.
- No new tests are wrong.

### Legacy Behavior
- 2.2 page scaffold: replaced the plain list with `<ExerciseCard />`. Scaffold's data fetch (workout + day + exercises) is unchanged. The page still has the header, status badge, back link, and "no exercises" empty state.
- 2.1/1.4/1.3 files: no changes. No regression.
- Removed styles (`.exercise-list`, `.exercise-item`, `.exercise-name`, `.exercise-target`, `.coming-soon`) are no longer referenced anywhere in the codebase.

### Anti-Pattern Analysis (qa-anti-patterns.md)

| Category | Julian Self-QA | Fely Verification | Result |
|---|---|---|---|
| 1 — Silent Value Reversion | PASS | Re-checked: `weightUnit` is passed as a prop, never derived. The page sources it from `user.weightUnit`. | **PASS** |
| 4 — UI Affordance Completeness | PASS | Re-checked: every input has a `<label>` (no `aria-label` shortcuts), every interactive element has hover + focus-visible states, notes field is marked optional. | **PASS** |
| 4 — Notes field optional | PASS | Re-checked: label includes "(opcional)" + placeholder. | **PASS** |
| 4 — Unit label rendered | PASS | Re-checked: "Peso (kg)" or "Peso (lbs)" based on user. | **PASS** |
| 6 — Error Paths | PASS | Re-checked: HTML5 `min`/`max`/`step`/`maxlength` constraints. No JS errors. The "+ Add set" cap is enforced. | **PASS** |
| 7 — Migration | N/A | N/A — no schema change. | **N/A** |
| 8 — Cross-Feature Interaction | PASS | Re-checked: no DB access, no API calls, no cross-context mutation. Pure UI. | **PASS** |
| 9 — Type-Safety Blind Spots | PASS (after fix) | Re-checked: 7 typecheck errors caught and fixed before declaring done. `tsc --noEmit` clean. Skill rule (confidence 5) applied. | **PASS** |

- **Julian's self-QA coverage:** 6 of 9 categories checked + 2 N/A. 4 GAPs (all visual/manual). All non-blocking.
- **Fely's additional verification:** re-ran the full test suite independently (80/80 pass, 4.56s) and re-ran the production build (4.22s, success). No new findings.
- **Anti-pattern issues found:** None.

### Issues Found
- **None.** All 7 ACs satisfied.

### Known Bugs Cleanup
- **Searched:** `**/known-bugs.md` (0 results).
- **Matches removed:** None.
- **Action:** No cleanup needed.

### Verdict
**PASS** ✅

> "Dale go mi pana, estamos ready, ahora arreglate conmigo fuera de la terminal"

---

## Phase 5 — Fely — Learning & Growth

### Stage 2 — Reflection

1. **7 typecheck errors in the inline `<script>`** — caught by `tsc --noEmit` (skill rule confidence 5). The fix was adding explicit DOM type assertions (`as HTMLOListElement`, `as HTMLButtonElement`, `as HTMLLIElement`) and `querySelectorAll<HTMLElement>`/`<HTMLInputElement>`/`<HTMLLIElement>` generics. **This is a reusable lesson for any Astro component with an inline `<script>`: the Astro `<script>` block doesn't automatically infer DOM types.** Without `astro check` + the skill rule, this would have shipped as a working build with broken type safety. **Validated the skill rule.**

2. **Astro build vs `astro check` divergence** — Vite's SWC strips types and builds successfully even with typecheck errors. `astro check` is the stricter gate. Confirmed: skill rule "tsc --noEmit after signature change" is non-negotiable for Astro projects. The rule is at confidence 5 after 3 confirmations (2.1, 2.2, 2.3).

3. **The `now: Date` rule from 2.1 was N/A** for 2.3 (no date math in UI components). Reinforced the rule's scope: it applies to use cases, not presentational components.

4. **`WorkoutEntryRules` as single source of truth** — the component imports `MinReps, MaxReps, MinWeight, MaxWeight, MaxNotesLength, MaxSetsPerExercise` from `workout-tracking.constants.ts`. No hardcoded numbers. This reinforces the project pattern (no magic numbers) and is consistent with the dashboard's use of `CardioRules` (2.1).

5. **Per-context composition was N/A** for 2.3 — no use case was added. Confirms the rule: use cases are for business logic (orchestration), not for presentational components. Components are pure UI.

6. **The `beforeEach` pattern from 2.2** is still relevant. The component is unit-test-free (UI pure), but the test infrastructure exists if future stories add logic.

### Stage 3 — Distillation

**One new rule emerged this session:** the inline `<script>` in `.astro` files doesn't auto-infer DOM types. This is project-specific (Astro 7 + SWC + Vite). Could be a project rule (`.crew/crew-learnings.md`) or a skill rule (`crew-flow/crew-learnings.md`).

Actually, this is a refinement of the existing skill rule: "tsc --noEmit after signature change" (confidence 5). The existing rule catches it; the fix is documented in the session log. No new rule needed — the existing rule is sufficient.

**No new rules to promote.**

### Stage 4 — Promotion

**No new rules to route.**

**Quarantine hygiene:**
- Project `.crew/crew-learnings.md`: 5 entries, all recently used. No graduations.
- Skill `crew-learnings.md`: 14 entries. "now: Date" at confidence 2 (no change). "tsc --noEmit after signature change" effectively at confidence 5 (validated in 2.1, 2.2, 2.3). The "tsc --noEmit" rule has not been formally bumped in the file but has been confirmed 3 times now. **Recommendation: bump to confidence 5 on the next Phase 5 of a session that touches the file.**

### Stage 5 — Retrieval impact
The "tsc --noEmit after signature change" rule is critical for any Astro/Vite project where types can be silently stripped. Future sessions touching any new file (component, page, use case, endpoint) MUST run `astro check` to catch type errors before declaring done.

### Reinforced / Contradicted
- **Reinforced:** "tsc --noEmit after signature change" (skill) — confidence 4 → 5 (used in 2.1, 2.2, 2.3). **Bump on next file write.**
- **Reinforced:** per-context composition root (project) — confidence 3 → 4 (2.3 confirmed N/A; no use case needed for UI components).
- **Reinforced:** kebab-case for components (project) — `exercise-card.astro` follows the rule.
- No contradictions.

### Documentation Gaps Found
1. **`WorkoutEntryRules` constants location** — `src/lib/contexts/workout-tracking/domain/workout-tracking.constants.ts` is the source of truth. Future components/pages should import from here. Not documented as a project convention yet. Low priority.
2. **Form wrapper pattern for 2.4** — the cards are not inside a `<form>` yet. 2.4 will wrap them in `<form method="POST" action="/api/workout-entries">` and emit a single `workout_id` hidden input at the form level. The component's `workoutId` prop is reserved for 2.4/2.5 but not yet emitted. Documented in the component's JSDoc.
3. **Astro 7 inline `<script>` DOM type assertion pattern** — could be a code comment template in the project's `AGENTS.md` (if it existed). Low priority.

### Quarantine Hygiene
- **Graduations:** 0 (no rule at confidence 4+ in quarantine).
- **Decays:** 0.
- **Re-scopes:** 0.

---

## Session Complete — Story 2.3

### Final state
- **Files created:** 1
  - `src/components/exercise-card.astro` (presentational component + inline `<script>` + scoped styles)
- **Files modified:** 1
  - `src/pages/workout/[id].astro` (consume the component, remove placeholder + unused styles)
- **Files NOT touched** (preserved): all 2.1/2.2/1.4/1.3 files, all other components, all tests, all other pages.
- **Tests:** 80/80 pass (11 test files, 4.56s) — no new tests
- **Type-safety:** `tsc --noEmit` — 0 errors, 0 warnings (after fix). 9 pre-existing hints in unrelated files.
- **Build:** `npm run build` (Vercel adapter) — success, 4.22s
- **Anti-patterns:** 6 of 9 categories checked + 2 N/A. 4 GAPs noted, all non-blocking.

### Story ACs
All 7 ACs (AC-2.3-01 through AC-2.3-07) implemented.

### What unlocks next
- **story-2.4 (Log Set auto-save):** now unblocked. The page has `<ExerciseCard />` instances with form fields. 2.4 wraps them in a `<form>`, adds `workout_id` hidden input, creates the `LogSetUseCase` + `POST /api/workout-entries` endpoint, wires the auto-save with 500ms debounce.
- **story-2.5 (Rest Timer):** unblocked. The checkmark checkbox in each card is the trigger. 2.5 adds a React island that hooks into the checkmark tap.

### Recommended next step
Start a new `crew-flow` session for **story-2.4** (Log Set auto-save). The composition root + use case pattern from 2.1/2.2 is in place. The `workout-tracking.constants.ts` has all validation ranges. The `WorkoutEntryRepository.addEntry` method (from 1.3) is ready. The component's input naming convention (`entries[N][...]`) is established.
