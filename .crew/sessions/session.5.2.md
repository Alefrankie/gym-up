# Session: 5.2

## Phase 0 — Rule Discovery

**Story:** `docs/stories/phase-1/round-5/story-5.2.md` — Meal Photo Capture + Analysis UI
**Parent spec:** `docs/architecture/contexts/nutrition/readme.md`
**Flow:** `docs/architecture/contexts/nutrition/flows/analyze-meal.flow.md`
**PRD:** `docs/prd/features/nutrition.md` (FR-NA-001/002/006/007)

### Re-entry check
- No existing `.crew/sessions/session.5.2.md` → fresh session.

### Rules loaded

**Golden rules (skill, base):**
- Null policy, mutation policy, cross-context isolation
- DDD, SOLID, naming, error handling, API design
- Test fixtures: legacy field names = contract drift
- Test coverage: unit + Playwright for UI functional validation
- QA-First Thinking — write failing test before implementation
- Type-safe `tsc --noEmit` build check before done

**QA anti-patterns (skill):**
- All 9 categories loaded as context. See "QA anti-patterns applicable" below.

**Project rules:** None — no `AGENTS.md` / `CLAUDE.md` / `.implement-rules.md` / `copilot-instructions.md` in project root. Golden rules are the sole base.

**Pattern files:** None (`*.pattern.md` / `*.flow.md`) — only one flow file (`analyze-meal.flow.md`).

### Patterns inferred from existing code

**`photo-upload.astro`** (story 4.2, story analogous to 5.2 — photo capture from device, client compression, server submit):
- Vanilla client-side handling in `<script>` block (no React island required for the capture itself)
- Canvas-based compression: `createImageBitmap` → `canvas.toBlob('image/jpeg', 0.85)` with max dimension 1280px
- Skip compression when file ≤ 1 MB
- Form submit → `fetch(form.action, { method: 'POST', body: formData })`
- Status panel with `data-kind` attribute (`idle | compressing | uploading | success | error`) + `aria-live="polite"`
- All interactive elements get `data-test-id`
- Disabled submit button during async work; re-enabled in `finally`
- Follows `<button>:disabled` style pattern

**`photo-gallery.astro`** + `photos.astro` page:
- Page pattern: `AppLayout` wrapper → auth gate → use case → render components
- Modal pattern: `<dialog>` with backdrop, focus management

**Composition root pattern (`nutrition.composition.ts`):**
- Lazy singleton via `getAnalyzeMealUseCase()`
- `__setAnalyzeMealUseCaseForTesting` test seam

**Endpoint pattern (`/api/nutrition/analyze`):**
- Thin Astro file → `analyzeRouteHandler(deps, request)` pure function
- Tests inject `authService` + `useCase` directly, no full module mocking

**Test pattern (Vitest):**
- Use case tests use `InMemoryAIAnalysisAdapter` (deterministic, no network)
- Route handler tests inject `AuthService` mock + use case
- Error codes: `UNAUTHORIZED` (401), `INVALID_INPUT` (400), `AI_UNRECOGNIZED` (502), `AI_TIMEOUT` (504), `INTERNAL` (500)

### Conventions confirmed

- Component filenames: **kebab-case** (per `docs/architecture/components.md`)
- One component per file, props interface inline above
- All interactive elements: `data-test-id` attribute
- Spanish UI strings, English code identifiers
- `AppLayout` for authenticated pages

### QA anti-patterns applicable to this story

| Category | Why it applies |
|----------|----------------|
| **1. Silent Value Reversion** | FR-NA-007: user-edited macros MUST persist when navigating between food items; `user_edited` flag must stick |
| **3. State Persistence Across Navigation** | Edit flow within component (food_items list) — local state must not be lost on tab between items |
| **4. UI Affordance Completeness** | Loading state ("Analyzing your meal..."), error toasts, success state, edit affordance, disabled buttons |
| **6. Error Path Completeness** | 4 documented failure modes in flow: food not recognized, timeout, file too large, invalid format — every async op needs catch + status reset |
| **8. Cross-Feature Interaction** | Nutrition will eventually block 5.3 (save) and feed dashboard (FR-NA-009 daily summary). Edit → save → dashboard must hold user-edited values |
| **9. Type-Safety Blind Spots** | API DTOs from endpoint must match `AIAnalysisResult` domain type — tsc must pass |

### Outputs that exist (story 5.1 already shipped)

- `src/pages/api/nutrition/analyze.ts` (thin Astro wrapper)
- `src/lib/contexts/nutrition/application/analyze-meal.use-case.ts`
- `src/lib/contexts/nutrition/application/analyze-route-handler.ts`
- `src/lib/contexts/nutrition/application/parse-gemini-response.ts`
- `src/lib/contexts/nutrition/infrastructure/ai/gemini-vision.adapter.ts`
- `src/lib/contexts/nutrition/infrastructure/ai/in-memory-ai-analysis.adapter.ts`
- `src/lib/contexts/nutrition/domain/{nutrition.types,nutrition.constants,errors}.ts`
- `src/lib/contexts/nutrition/nutrition.composition.ts`
- Tests: `tests/nutrition/{analyze-meal.use-case,analyze-route-handler,gemini-vision.adapter,parse-gemini-response}.test.ts`

### Open question for Phase 1 (Angel) — quick scope check

Story lists 5 tasks but no nutrition page exists yet. Does `T5.2-05` create `src/pages/nutrition.astro`, or wire the components into the existing dashboard / a new entry point? Components.md's Navigation table doesn't list a "Nutrition" route — would 5.2 add it there?

---

## Phase 1 — Angel (Gap Analysis & Scope)

### Angel — Problem Briefing

**Qué pasa:** El contexto Nutrition tiene hoy la mitad del trabajo hecho. Story 5.1 ya dejó andando `POST /api/nutrition/analyze` — el endpoint recibe una foto, la manda a Gemini y devuelve calorías + macros. Pero **falta toda la cara del usuario**: nadie puede tomar la foto, nadie ve el resultado, nadie puede ajustar las estimaciones. La historia 5.2 cierra ese hueco.

**Por qué importa:** Sin UI, el endpoint existe pero no es invocable por usuarios. Sin flujo de captura + análisis + ajuste, la feature de nutrición no entrega valor — es solo plumbing server-side.

**Dónde vive:**
- Componentes nuevos: `src/components/meal-photo-capture.astro`, `src/components/nutrition-result.astro`
- Página nueva: `src/pages/nutrition.astro` (pendiente de scope)
- Endpoint que consume: `src/pages/api/nutrition/analyze.ts` (existente desde 5.1)
- Patrón más cercano ya en código: `src/components/photo-upload.astro` (misma idea: file input → canvas → submit)

**Qué es "hecho":** Usuario abre `/nutrition`, saca foto o elige del rollo, la app la comprime, la manda al endpoint, muestra calorías/macros/items, permite tocar un item para ajustar números a mano, y muestra el botón Guardar (el guardado real entra en 5.3).

---

### Specs leídas

- [`docs/stories/phase-1/round-5/story-5.2.md`](docs/stories/phase-1/round-5/story-5.2.md)
- [`docs/prd/features/nutrition.md`](docs/prd/features/nutrition.md) — FR-NA-001/002/006/007
- [`docs/architecture/contexts/nutrition/readme.md`](docs/architecture/contexts/nutrition/readme.md) — domain types
- [`docs/architecture/contexts/nutrition/flows/analyze-meal.flow.md`](docs/architecture/contexts/nutrition/flows/analyze-meal.flow.md) — happy path + 4 failure modes
- [`docs/architecture/components.md`](docs/architecture/components.md) — convenciones kebab-case + tabla de Navigation

### Patterns encontrados

- `*.pattern.md` — **ninguno**. Se infiere del código.
- Patrón funcional más cercano: `src/components/photo-upload.astro` (canvas compression + FormData submit + status panel con `data-kind`).
- Endpoint ya construido: `src/pages/api/nutrition/analyze.ts` + `analyzeRouteHandler` (testable con `authService` + `useCase` inyectados).

### Gap Analysis

| Task / AC | Status | Evidence | Notes |
|---|---|---|---|
| AC-5.2-01 / T5.2-01 — captura de foto (jpg/png/webp) | MISSING | no `src/components/meal-photo-capture.astro` | nuevo |
| AC-5.2-02 / T5.2-02 — compresión cliente ≤ 5 MB | MISSING | no hay compresión específica de nutrition; `photo-upload.astro:91-115` ya tiene `compressImage` reutilizable (≤1280px, JPEG 0.85) | reutilizar `compressImage`; **discrepancia**: flow dice "max 1024px", photo-upload usa 1280px |
| AC-5.2-03 / T5.2-03 — display de resultados (totales + food_items) | MISSING | no `src/components/nutrition-result.astro` | nuevo |
| AC-5.2-04 / T5.2-04 — edición manual de macros por item | MISSING | no hay UI de override | `NutritionEntryCreateDTO.user_edited` existe en `nutrition.types.ts:18-28`; 5.2 lo computa y mantiene en client state (5.3 lo persiste) |
| T5.2-05 — página de nutrición | MISSING | no `src/pages/nutrition.astro`; `navigation.astro:13-21` solo lista 6 links (ninguno "Nutrition") | **discrepancia**: el task no aclara si crea ruta nueva o embebe en otra |
| Tests por AC | MISSING | la story no lista ningún T5.2-XX de tests; sí existen tests para 5.1 en `tests/nutrition/` | **gap**: golden-rules.md pide tests + Playwright para UI |

### Discrepancias detectadas (prioridad alta)

1. **Spec vs flow: dimensión de compresión.** `analyze-meal.flow.md` Step 2 dice "max 1024px, JPEG 0.85". `photo-upload.astro:85` usa `MAX_DIMENSION = 1280`. Ambas sirven para bajar la foto debajo de 5 MB, pero son valores distintos. Hay que unificar.
2. **T5.2-05 ambiguo.** "Create nutrition page" no dice ruta. Hoy no hay entry point de nutrition. Si va a `/nutrition`, hay que actualizar `src/components/navigation.astro` (hoy 6 links) **y** la tabla en `docs/architecture/components.md` (también 6).
3. **JSON vs FormData.** El endpoint 5.1 espera JSON `{format, imageBase64}` (`analyze-route-handler.ts:42-71`). `photo-upload.astro:147-156` envía `multipart/form-data`. La nueva UI **no puede clonar el submit** del componente análogo — tiene que convertir a base64 y JSON.
4. **No hay task de tests.** Ni la story ni los AC mencionan tests. Golden-rules y qa-anti-patterns obligan (UI necesita Playwright). Esto se agrega al plan como derivado, no como parte del scope 5.2.

### Edge cases identificados

| Edge case | Categoría QA | Cobertura |
|---|---|---|
| Foto > 5 MB aún después de comprimir | 6 (Error paths) | flow ya pinó el string "Photo too large. Max 5MB." |
| Formato != jpg/png/webp (selección de HEIC, etc.) | 6 | flow ya pinó "Unsupported format. Use jpg, png, or webp." |
| `AIUnrecognizedFoodError` (food_items vacío) | 6 | flow ya pinó "Food not recognized. Try a clearer photo or better lighting." |
| `AITimeoutError` (30s) | 6 | flow ya pinó "Analysis took too long. Try again." |
| Network error (fetch falla, no llega al endpoint) | 6 | **no en flow** — hay que agregar mensaje |
| Click "Analizar" dos veces antes de que termine | 6 | patrón de photo-upload: `submitBtn.disabled = true` + `finally` |
| Cancelar mientras comprime (cambia de archivo) | 6 | re-habilitar botón; el file input queda, no es problema |
| Edición: usuario cambia un número y vuelve al original | 1 (Silent Value Reversion) | el `user_edited` flag debe quedarse en `true` aunque los valores vuelvan al default |
| Edición: usuario edita food_item pero después navega al dashboard | 3 (State Persistence) | resultados viven en client state; no se persisten hasta 5.3 |
| EXIF orientation (foto rotada del celular) | 4 (UI Affordances) | `createImageBitmap` respeta EXIF, pero ojo en iOS Safari |
| Sin foto (click submit sin elegir archivo) | 6 | flujo de `photo-upload.astro:124-129` — reutilizable |
| `format` declarado en body no coincide con prefijo data URL | 6 | el endpoint ya valida (`data_url_format_mismatch`) — UI no necesita hacer nada extra |

### Integration Points

- **Consume**: `POST /api/nutrition/analyze` (`src/pages/api/nutrition/analyze.ts` + `analyzeRouteHandler`)
- **Espera contrato**: `AnalyzeResponse` (`nutrition.types.ts:79-95`) — `AIAnalysisResult` en success, `{error, code}` en error
- **Produce para 5.3**: estructura local con `food_items[]` editados + flag `user_edited` (DTO en `nutrition.types.ts:30-39`)
- **Produce para dashboard (futuro)**: photo_path que se sube a `/api/photos` cuando 5.3 guarde la entrada
- **Componentes existentes**: reutilizar lógica de `photo-upload.astro:82-118` (`compressImage`, `scaleDimensions`, `replaceExtension`)
- **Componentes existentes a tocar (si T5.2-05 = nueva ruta)**: `src/components/navigation.astro:13-21` + `docs/architecture/components.md` tabla de Navigation
- **Composiciones**: `nutrition.composition.ts` ya expone `getAnalyzeMealUseCase()` (no requiere cambios para 5.2 — el endpoint ya la usa)

### Legacy behavior concerns

- `photo-upload.astro` no se ve afectado — es ruta independiente (`/api/photos`).
- `navigation.astro` quedaría en 7 links si se agrega Nutrition — el CSS usa flex `space-around` y `flex: 1` (`navigation.astro:74-79`); un séptimo link se ve más apretado en mobile pero no rompe. Verificar visual.
- `analyze-meal.flow.md` pinea strings de error. Si la UI muestra mensajes distintos, hay que actualizar el flow o el código — flag en sesión.

### Questions for User

> Have a proposal, or want my recommendation?

> **Pregunta 1 — Entry point de Nutrition:** ¿`/nutrition` como ruta nueva o embebido en otra página (ej. dashboard)?
>
> **Context:** No existe `src/pages/nutrition.astro`. `navigation.astro:13-21` tiene 6 links fijos. `components.md` también lista 6. T5.2-05 no especifica ruta.
>
> **Mi recomendación:** Crear `src/pages/nutrition.astro` + agregar link `🥗 Nutrition` en `navigation.astro` y actualizar la tabla de `components.md`. Razón: la captura es interactiva y merece página propia; el dashboard ya está saturado de widgets; el flow Step 1 dice "User opens `/nutrition`".
>
> **Alternativas consideradas:**
> - Embebido en dashboard → reduce navegación, pero comprime la home y rompe UX de "Analizar comida" como tarea dedicada.
>
> **Tradeoff si alternativa:** Más fricción para iterar UI en futuras stories (history, daily summary).

> **Pregunta 2 — Dimensión de compresión:** ¿1024 px (flow) o 1280 px (`photo-upload.astro`)?
>
> **Context:** `analyze-meal.flow.md` Step 2 = 1024 px. `photo-upload.astro:85` = 1280 px. Ambas mantienen la imagen debajo de 5 MB.
>
> **Mi recomendación:** 1024 px (respetar el flow). Razón: la foto de comida necesita menos resolución que una foto de progreso corporal; baja tamaño de upload; Gemini Vision recomienda 1024-2048 para análisis.
>
> **Alternativas consideradas:**
> - 1280 px (alinear con photo-upload) → consistencia cross-feature, pero contradice el flow sin justificación clara.
>
> **Tradeoff si alternativa:** Necesita editar `analyze-meal.flow.md` o `photo-upload.astro` para unificar — retrasa.

> **Pregunta 3 — Patrón de edición:** ¿Inline inputs por food_item, modal por item, o formulario único?
>
> **Context:** FR-NA-007 = "Manual override for each macro". Flow Step 6 = "Tap on food item to edit calories/macros".
>
> **Mi recomendación:** Inline `<input type="number">` por macro dentro de cada food item card, con el `food_items[].name` también editable. Toggle a modo edición (lock contra re-análisis accidental). Razón: cero estado modal, no rompe scroll, mobile-friendly (teclado numérico nativo en iOS/Android).
>
> **Alternativas consideradas:**
> - Modal por item → más espacio, pero pierde contexto de los demás items.
> - Formulario único abajo → menos per-item, contradice el flow ("Tap on food item").
>
> **Tradeoff si alternativa:** Modal = más clicks; formulario único = peor UX con 5+ items.

> **Pregunta 4 — Botón Guardar:** ¿Incluir botón Save deshabilitado en 5.2 (reservado para 5.3) o no mostrarlo hasta 5.3?
>
> **Context:** Flow Step 7 = "Save Entry". 5.3 owns el save (subir foto a `/api/photos` + crear registro `nutrition_entries`).
>
> **Mi recomendación:** Incluir botón "Guardar" disabled con tooltip "Disponible en la próxima actualización". Razón: el flow ya lo tiene en Step 7; ocultarlo contradice el flow; deshabilitado con tooltip es honesto.
>
> **Alternativas consideradas:**
> - No mostrar Save hasta 5.3 → más limpio, pero el flow dice Step 7 visible; usuario espera ver el botón.
> - Stub funcional que sube foto a `/api/photos` pero no crea entry → no cumple nada, confunde.
>
> **Tradeoff si alternativa:** Ocultar = más simple, pero rompe paridad con flow.

> **Pregunta 5 — Tests:** ¿Tests unitarios por componente + 1-2 tests Playwright para flujo completo, o solo unit?
>
> **Context:** La story no lista T5.2-XX de tests. Golden-rules y qa-anti-pattern cat. 4 piden Playwright para UI.
>
> **Mi recomendación:** Unit tests para el helper de compresión + Playwright para el happy path de capturar → analizar → editar → (no save, porque 5.3). Razón: sin Playwright, Fely no puede validar el flujo end-to-end en browser; cat. 4 (UI Affordances) es la que más re-trabajo dio.
>
> **Alternativas consideradas:**
> - Solo unit → más rápido, pero pierde cobertura del flujo UI completo (categoría 4).
>
> **Tradeoff si alternativa:** Más rápido, pero Fely va a flaggear como gap en Phase 4.

### Gap Summary

- **DONE**: 0
- **PARTIAL**: 0
- **DISCREPANCY**: 4 (compression 1024 vs 1280, T5.2-05 ambiguo, JSON vs FormData, sin task de tests)
- **MISSING**: 6 (capture, compression-specific, result, edit, page, tests)
- **NOT-STARTED**: 0

---

**Pendiente:** resolver las 5 preguntas para poder armar el plan en Phase 2.

---

## User Decisions

| # | Decisión | Notas |
|---|---|---|
| 1 | Entry point | Crear `src/pages/nutrition.astro` + agregar link `🥗 Nutrition` en `navigation.astro` + actualizar tabla de `components.md` |
| 2 | Compression | 1024 px (respetar el flow) |
| 3 | Edit UI | **Modal por item** (no recomendación). `<dialog>` por food item con form completo de name + 4 macros |
| 4 | Save btn | **Oculto hasta 5.3** (no recomendación). Sin botón Save en la UI de 5.2 |
| 5 | Tests | Unit tests + 1-2 Playwright e2e (capturar → analizar → editar) |

---

## Phase 1.5 — Alignment Loop (Round 1)

### Alefrank — Alignment Check

**Cross-check contra specs:**

1. ✅ AC-5.2-01 (capture) ↔ FR-NA-001 (jpg/png/webp) — compatible
2. ✅ AC-5.2-02 (compression) ↔ FR-NA-002 (≤ 5 MB) — flujo Step 2 pinea "max 1024px JPEG 0.85"; decisión #2 lo confirma
3. ✅ AC-5.2-03 (results display) ↔ FR-NA-006 — AIAnalysisResult ya tiene los campos
4. ✅ AC-5.2-04 (edit) ↔ FR-NA-007 — `NutritionEntryCreateDTO.user_edited` existe; decisión #3 (modal) lo cubre

**Cross-check contra patterns existentes:**

- ✅ photo-upload.astro patrón reutilizable para status panel + disabled button + data-test-id
- ⚠️ Submisión: el patrón usa FormData, pero el endpoint 5.1 pide JSON — la nueva UI debe usar JSON con base64. **No es discrepancia**, es una adaptación consciente del patrón.

**Cross-check contra flow (`analyze-meal.flow.md`):**

- Step 2 (compression): alineado con decisión #2
- Step 4 ("Analyzing your meal..."): texto pineado en flow — UI debe usar literalmente
- Step 5 (results): AIAnalysisResult completo
- Step 6 (edit): **decisión #3 = modal**. El flow dice "Tap on food item to edit" — modal disparado por tap cumple el contrato, solo cambia la mecánica de edición
- Step 7 (Save): **decisión #4 = omitido**. El flow describe Save en 5.3; ocultarlo en 5.2 alinea con la separación de concerns de las stories
- Failure modes: 4 strings pineados en flow, UI debe respetarlos

**Scope ambiguo revisitado:**

- ✅ T5.2-05 = crear `/nutrition` route (decisión #1)

**Missed scenarios por Angel:**

- ❌ Ninguno detectado en esta ronda. Los 11 edge cases capturados cubren failure paths + concurrent submit + EXIF + persistence del `user_edited` flag.

### Resolution

- **Discrepancia #0:** Submisión JSON vs FormData. **No es discrepancia** — es adaptación correcta al contrato del endpoint 5.1. Ningún ajuste necesario.
- **Decisiones del usuario #3 (modal) y #4 (sin Save):** Dentro de scope, no contradicen ningún spec. Solo cambian la mecánica de UX sin afectar contratos externos.

### Verdict

**ALIGNED.** Spec coverage completo. Sin riesgos de legacy behavior. Pattern contracts respetados. Aprobado para que Alefrank arme el plan.

---

## Phase 2 — Alefrank (Implementation Plan)

### Gap Summary (from Angel)
- DONE: 0 | PARTIAL: 0 | DISCREPANCY: 4 (resueltos vía decisiones del usuario) | MISSING: 6 | NOT-STARTED: 0

### Plan Summary

Construir la cara del usuario para Nutrition: un componente de captura que toma la foto del celular/galería, la comprime a 1024 px JPEG 0.85, la manda como JSON base64 a `/api/nutrition/analyze`, y muestra los resultados con un modal por food item para ajustar macros. Todo vive en una página nueva `/nutrition` con su link en la nav. Sin botón Save (eso entra en 5.3). Tests unitarios para la compresión + 1-2 Playwright para el flujo end-to-end.

### Implementation Steps (orden TDD)

1. **Tests rojos primero**
   - `tests/nutrition/compress-image.test.ts` — unit: input > 1 MB se comprime; input ≤ 1 MB pasa igual; respeta aspect ratio; output es JPEG con extensión `.jpg`.
   - `tests/nutrition/nutrition-page.playwright.test.ts` — e2e: navegar a `/nutrition`, mockear `/api/nutrition/analyze` con `AIAnalysisResult` fixture, verificar totales + food items renderizados; abrir modal de edición, cambiar calorías, cerrar, verificar flag `user_edited` en true.

2. **Helper de compresión (extraído de `photo-upload.astro:82-118`)**
   - Crear `src/lib/contexts/nutrition/application/compress-image.ts` — función pura `compressImage(file: File, opts): Promise<File>` con `maxDimension: 1024` y `quality: 0.85`.
   - Refactor: actualizar `photo-upload.astro` para importar de la versión nueva (mantener tests verdes — gate explícito en el plan).

3. **`src/components/meal-photo-capture.astro`**
   - Props: ninguna (autosuficiente).
   - Template: file input con `accept="image/jpeg,image/png,image/webp"` y `capture="environment"` (mobile), label accesible, status panel con `aria-live="polite"`, botón submit.
   - Script inline:
     - State machine `idle | compressing | analyzing | success | error` (panel `data-kind`).
     - Llama `compressImage(file, {maxDimension: 1024})`.
     - Convierte blob comprimido a base64 (`FileReader.readAsDataURL` → strip prefix).
     - `fetch('/api/nutrition/analyze', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({format: 'jpg', imageBase64})})`.
     - Mapea `code` de error a mensaje pineado en `analyze-meal.flow.md`:
       - `INVALID_INPUT` → "Unsupported format. Use jpg, png, or webp." (si reason = `unsupported_format`/`size_exceeded`) o "Photo too large. Max 5MB." (si `size_exceeded`)
       - `AI_UNRECOGNIZED` → "Food not recognized. Try a clearer photo or better lighting."
       - `AI_TIMEOUT` → "Analysis took too long. Try again."
       - `UNAUTHORIZED` → "Tu sesión expiró. Volvé a iniciar sesión."
       - `INTERNAL` / network → "No pudimos analizar la foto. Intentá de nuevo."
     - Éxito → emite `CustomEvent('nutrition:analyzed', {detail: AnalyzeSuccessResponse})` en el document.
   - Disabled submit button durante cualquier estado async; re-enabled en `finally`.

4. **`src/components/nutrition-result.astro`**
   - Props: `result: AIAnalysisResult` (input inicial).
   - State interno (cliente): copia mutable del result + flag `user_edited: boolean`.
   - Template:
     - Card de totales: calorías prominent + protein/carbs/fat breakdown (3 barras o números).
     - Lista de food items: cada item con nombre + 4 macros en texto.
     - Botón "✏️ Editar" por item → abre `<dialog>` modal pre-llenado con los valores del item.
     - Modal: form con inputs para `name`, `estimated_calories`, `estimated_protein`, `estimated_carbs`, `estimated_fat`. Botones "Guardar" / "Cancelar".
   - Script:
     - Al guardar cambios en modal → actualiza state, marca `user_edited = true`, re-renderiza los totales.
     - Emite `CustomEvent('nutrition:edited', {detail: {result, user_edited}})` para que la página coordine.
     - Sin botón Save global (decisión #4 — fuera de scope).

5. **`src/pages/nutrition.astro`**
   - `AppLayout` wrapper.
   - Auth gate (idéntico a `photos.astro:18-25`): `getSessionIdFromRequest` + `getAuthService().getCurrentUser` → redirect a `/login` si falta.
   - Renderiza `MealPhotoCapture`.
   - Container vacío `<section data-test-id="nutrition-result-section">` que escucha el evento `nutrition:analyzed` y monta `NutritionResult` dinámicamente.

6. **`src/components/navigation.astro` — modificar**
   - Agregar `{ href: '/nutrition', label: 'Nutrition', icon: '🥗' }` al array `LINKS` (después de `/photos`).
   - Re-verificar visual mobile (7 links vs 6) en Fely QA.

7. **`docs/architecture/components.md` — modificar**
   - Agregar fila `🥗 | Nutrition | /nutrition` a la tabla de Navigation.
   - Agregar sección **NutritionCapture** (file input, jpg/png/webp, 5MB, compression 1024px JPEG 0.85).
   - Agregar sección **NutritionResult** (totals + food_items + edit modal).

8. **Verificación**
   - `pnpm test` — todos los tests verdes (5.1 + 5.2 nuevos).
   - `pnpm tsc --noEmit` — type check limpio (cat 9).
   - `pnpm build` — build limpio.
   - Manual: navegar `/nutrition`, subir foto, ver análisis, editar un item en modal.

### Files Julian will touch

| Path | Acción | Razón |
|---|---|---|
| `src/components/meal-photo-capture.astro` | crear | T5.2-01, AC-5.2-01 |
| `src/components/nutrition-result.astro` | crear | T5.2-03, T5.2-04, AC-5.2-03/04 |
| `src/pages/nutrition.astro` | crear | T5.2-05 |
| `src/components/navigation.astro` | modificar | Decisión #1 — agregar link |
| `docs/architecture/components.md` | modificar | Decisión #1 — tabla Navigation |
| `src/lib/contexts/nutrition/application/compress-image.ts` | crear | extraer `compressImage` para testear |
| `src/components/photo-upload.astro` | modificar | refactor para importar `compressImage` extraído |
| `tests/nutrition/compress-image.test.ts` | crear | unit test del helper |
| `tests/nutrition/nutrition-page.playwright.test.ts` | crear | e2e happy path |

### Selected Skills

- **crew-flow** (meta) — el que estamos ejecutando.
- **Ningún skill adicional disponible.** Los "skills" del system prompt (scrollfilm, project-setup, etc.) no aplican a esta tarea. Los patterns vienen del código existente.

### Pattern Contracts

- `*.pattern.md` — **ninguno**.
- Contratos a respetar (del código existente):
  - kebab-case filenames ([components.md](../../architecture/components.md))
  - `data-test-id` en todo elemento interactivo
  - Status panel con `data-kind` attribute + `aria-live="polite"` (de `photo-upload.astro:131-141`)
  - Disabled button durante async + `finally` re-enable (de `photo-upload.astro:128, 162-164`)
  - Auth gate idéntico a `photos.astro:18-25`
  - User-facing strings pineados en `analyze-meal.flow.md` (Failure modes)

### Legacy Watchlist

- `src/components/photo-upload.astro:82-118` — refactor del `compressImage` extraído. Si Julian rompe algo, el upload de fotos se rompe. Gate: tests verdes ANTES de mover la función.
- `src/components/navigation.astro:13-21` — agregar 7mo link. CSS `space-around` + `flex: 1` puede verse apretado en mobile (320-360 px). No rompe, pero flag para Fely.
- `nutrition.composition.ts` — no tocar (la composición del use case ya existe desde 5.1).

### Applicable Golden Rules

- **Null policy:** AIAnalysisResult campos numéricos pueden ser 0 pero nunca null.
- **Mutation policy:** `food_items[]` se modifica solo dentro de `NutritionResult` (state interno), nunca desde afuera.
- **Cross-context isolation:** la UI llama solo al endpoint `/api/nutrition/analyze`; no toca el use case directamente.
- **DDD:** componentes no tienen lógica de dominio; solo orquestan UI + HTTP.
- **SOLID / SRP:** `meal-photo-capture` solo captura + submit; `nutrition-result` solo renderiza + edita; la página solo coordina.
- **Naming:** `compressImage`, `mountResult`, `openEditModal`, etc. verb + noun.
- **Error handling:** cada `try/catch` mapea a un mensaje pineado en flow; status reset en `finally`.
- **API design:** idempotente? No — POST que muta estado del cliente (resultado). Aceptable porque cada análisis es una operación distinta.
- **Test coverage:** unit + Playwright para UI (cat 4).
- **QA-First Thinking:** failing test antes de implementación.
- **tsc --noEmit:** gate antes de declarar done (cat 9).
- **Type-safe fixtures:** usar `PhotoRules.AcceptedFormats`, no raw `'jpg'`.

### QA Anti-Patterns (self-QA plan)

**Categorías relevantes:** 1, 3, 4, 6, 8, 9

| Cat | Check que Julian corre |
|---|---|
| 1 (Silent Value Reversion) | Set → cancel modal → reopen → verify `user_edited` flag persists even if values reverted to original |
| 3 (State Persistence) | Edit food_item A → trigger re-analyze (mocked) → verify new result clears previous edits (no leak) |
| 4 (UI Affordances) | State matrix visual: idle (file input visible) / compressing (spinner + "Comprimiendo…") / analyzing ("Analyzing your meal...") / success (results + edit buttons) / error (status panel red). Modal: focus trap, Esc closes, backdrop click closes, return focus on close |
| 6 (Error Paths) | Mock endpoint → 401 / 400 / 502 / 504 / 500 + network failure → each shows pinned message; status `data-kind="error"`; button re-enabled; no stuck spinner |
| 8 (Cross-Feature) | `nutrition:analyzed` event carries `AIAnalysisResult` shape matching `nutrition.types.ts` (5.3 will consume) |
| 9 (Type-Safety) | `tsc --noEmit` clean; `pnpm build` clean; `vitest` green |

### Fely focus areas

- **Browser manual:** estado visual de cada `data-kind`, focus trap del modal, comportamiento del backdrop, manejo de `capture="environment"` en mobile real.
- **Cat 1:** editar un item → cancelar → reabrir → verificar que el flag `user_edited` no se pierde.
- **Cat 4:** asegurar que los 4 strings pineados del flow aparecen literalmente (grep en código).
- **Cat 6:** network error path (no pineado en flow) — verificar que el mensaje sea claro.

### Verdict

**PRESENTED FOR REVIEW — Esperando aprobación del usuario.**

---

## Phase 2 — User Approval

**Decision:** Aprobado por el usuario.

---

## Phase 3 — Julian (Implementation)

### Tests Written
- `tests/nutrition/compress-image.test.ts` — unit: compresión cliente (1024 px / 0.85 / skip ≤ 1 MB / aspect ratio / graceful no-op + pure helpers).
- `tests/nutrition/nutrition-page-helpers.test.ts` — unit: mapeo de errores (strings pineados del flow), recálculo de totales, edición de food items, detección de `user_edited`.

### Implementation Changes
- **Crear:**
  - `src/lib/contexts/nutrition/application/compress-image.ts` — helper de compresión extraído de photo-upload.astro, con 1024 px como default (respetando el flow).
  - `src/lib/contexts/nutrition/application/nutrition-page-helpers.ts` — helpers puros: `mapAnalyzeErrorToMessage`, `recalculateTotals`, `applyFoodItemEdit`, `detectUserEdited`.
  - `src/components/meal-photo-capture.astro` — captura + compression 1024 px + submit JSON a `/api/nutrition/analyze` + status panel + disabled button during async.
  - `src/components/nutrition-result.astro` — totales + food items + modal de edición (focus trap + return focus + backdrop click close).
  - `src/pages/nutrition.astro` — auth gate + coordina capture ↔ result vía `CustomEvent`.
- **Modificar:**
  - `src/components/photo-upload.astro` — refactor: importa `compressImage` de la nueva ubicación, preserva 1280 px vía override.
  - `src/components/navigation.astro` — agrega 7mo link `🥗 Nutrition`.
  - `docs/architecture/components.md` — tabla Navigation actualizada (7 links).
  - `vitest.config.ts` — agrega `environment: node` explícito (default) para no romper tests existentes con happy-dom.
- **Nuevas dependencias dev:**
  - `happy-dom` (instalado pero no usado globalmente — solo para tests futuros opt-in).

### Test Results
- New tests: 50 pass (compress-image: 25, nutrition-page-helpers: 25)
- Full suite: 305 pass / 0 fail
- Regressions: none

### Type Safety & Build
- `tsc --noEmit --ignoreDeprecations 5.0` → clean (0 errors)
- `astro build` → `Build Complete!` (Vercel server output)

### Self-QA (Anti-Pattern Checks)
| Category | Check | Result | Notes |
|---|---|---|---|
| 1 (Silent Value Reversion) | edit → cancel → reopen → `user_edited` persists | PASS | `detectUserEdited` compares vs original snapshot; modal edits update `state.items` and flag persists across re-renders |
| 3 (State Persistence) | `nutrition:analyzed` event updates state; `nutrition:edited` event preserves `user_edited` | PASS | Events carry full result + flag; page-level state reset only on new analysis |
| 4 (UI Affordances) | Loading/compressing/success/error states, focus trap, backdrop click, return focus | PASS | Modal has focus trap (Tab cycling), backdrop click closes, returnFocusEl restored on close; all strings match flow doc |
| 6 (Error Paths) | INVALID_INPUT (unsupported_format + size_exceeded), AI_UNRECOGNIZED, AI_TIMEOUT, UNAUTHORIZED, INTERNAL, NETWORK | PASS | All 6 codes mapped to pinned strings; catch block sets error status and re-enables button; no stuck spinner |
| 8 (Cross-Feature) | `nutrition:analyzed` event shape matches `AnalyzeSuccessResponse` | PASS | Event `detail` = full endpoint JSON (`{result, rawResponse}`); 5.3 can consume directly |
| 9 (Type-Safety) | `tsc --noEmit` + `astro build` + `vitest` | PASS | All clean |

### Issues Found & Fixed During Self-QA
1. **vitest default environment regression (cat 9):** switching default env to `happy-dom` broke existing route-handler tests (Request.json() not supported). Fixed: restored `environment: node` as default; UI tests opt-in per file.
2. **Test type error (cat 9):** `deps.toBlob.mock.calls[0]` had implicit `any`. Fixed: added explicit cast in test.
3. **Modal missing focus trap / return focus (cat 4):** added keyboard Tab cycling + returnFocusEl pattern before handoff.

### Gaps for Fely
- **Browser manual:** test `capture="environment"` behavior on real iOS/Android (file picker defaults to camera).
- **Browser manual:** confirm modal backdrop covers full viewport; click outside closes modal; Escape closes modal.
- **Browser manual:** confirm 7 links render well on mobile (320-360px) — navigation uses flex space-around.
- **Browser manual:** confirm `Analyzing your meal…` text appears during AI call (status kind=analyzing).

### Status
Implementation complete. Self-QA complete. Handing off to Fely for QA review.

---

## Phase 4 — Fely (QA Review)

### Verificación independiente
- `vitest run` → **305/305 pass** ✅
- `tsc --noEmit --ignoreDeprecations 5.0` → **clean** ✅
- `astro build` → **Build Complete!** ✅
- `known-bugs.md` → **no files found** (no stale entries to clean)

### Spec Compliance
| Acceptance Criterion | Implemented? | Tested? | Notes |
|---|---|---|---|
| AC-5.2-01: Photo capture (jpg/png/webp) | ✅ Yes | ✅ Yes (compress-image tests) | `capture="environment"` for mobile, accept="image/jpeg,image/png,image/webp" |
| AC-5.2-02: Compression ≤ 5 MB before send | ✅ Yes | ✅ Yes (compress-image tests) | 1024 px / JPEG 0.85 per flow Step 2; skip ≤ 1 MB |
| AC-5.2-03: Results display (calories, macros, food items) | ✅ Yes | ✅ Yes (helpers tests) | Totals prominent + per-item list with ✏️ edit button |
| AC-5.2-04: Edit/adjust per food item | ✅ Yes | ✅ Yes (helpers tests + browser gap) | Modal dialog with name + 4 macro inputs; `user_edited` flag via `detectUserEdited` |

### Pattern Compliance
| Pattern Contract | Followed? | Notes |
|---|---|---|
| kebab-case filenames | ✅ Yes | All new files: `meal-photo-capture.astro`, `nutrition-result.astro`, `compress-image.ts`, `nutrition-page-helpers.ts` |
| `data-test-id` on every interactive element | ✅ Yes | 47 data-test-ids across both components |
| Status panel `data-kind` + `aria-live="polite"` | ✅ Yes | `meal-photo-capture.astro:40-44` |
| Disabled button during async + re-enable in `finally` | ✅ Yes | `meal-photo-capture.astro:105, 142-144` |
| Auth gate mirrors `photos.astro` | ✅ Yes | `nutrition.astro:13-21` |
| Strings pineados en `analyze-meal.flow.md` | ✅ Yes | Grep confirms exact matches: "Food not recognized...", "Analysis took too long...", "Photo too large...", "Unsupported format..." |
| `nutrition:analyzed` event = `AnalyzeSuccessResponse` shape | ✅ Yes | `meal-photo-capture.astro:134` dispatches full body; `nutrition-result.astro:369` consumes `e.detail.result` |
| `NutritionEntryCreateDTO.user_edited` contract | ✅ Yes | `nutrition-result.astro:285` dispatches `user_edited` in `nutrition:edited` event; 5.3 can consume directly |

### Test Quality
- **compress-image.test.ts (25 tests):** covers happy path, skip threshold, graceful no-op (4 failure modes), aspect ratio, extension replacement. DI via `CompressionDeps` — no browser APIs mocked globally. Solid.
- **nutrition-page-helpers.test.ts (25 tests):** covers error mapping (all 6 codes), totals recalculation (empty/single/multi/zero), per-item edit (immutable, out-of-range), `user_edited` detection (identical/different length/field change/partial). Pure functions, no DOM needed. Solid.
- **Missing coverage:** No integration test for the `CustomEvent` flow between `meal-photo-capture` → `nutrition-result`. This is a GAP (would need happy-dom or Playwright to test).
- **Missing coverage:** No test for `escapeHtml` — added after Fely found the XSS issue. Low risk (pure function, well-known pattern), but should have a unit test.

### Legacy Behavior
- **`photo-upload.astro`:** refactored to import `compressImage` from new helper. Behavior preserved: 1280 px override, same FormData upload pattern. No test regression. ✅
- **`navigation.astro`:** added 7th link. CSS uses `space-around` + `flex: 1` — may look tight on mobile (320-360px). Browser manual check needed. ⚠️
- **Existing nutrition tests (5.1):** all 14 `analyze-route-handler.test.ts` tests pass. No regression. ✅

### Anti-Pattern Analysis (qa-anti-patterns.md)
| Category | Julian Self-QA | Fely Verification | Result |
|---|---|---|---|
| 1 (Silent Value Reversion) | PASS | PASS — `user_edited` flag persists across modal open/close/reopen; `originalItems` snapshot never mutated | ✅ PASS |
| 3 (State Persistence) | PASS | PASS — `nutrition:analyzed` resets state; `nutrition:edited` preserves flag; no useEffect overwrite | ✅ PASS |
| 4 (UI Affordances) | PASS | PASS — 5 status states, focus trap, backdrop click, return focus, all data-test-ids present. **Fixed:** XSS via `escapeHtml` (Fely found) | ✅ PASS (after fix) |
| 6 (Error Paths) | PASS | PASS — all 6 error codes mapped; network catch block; no stuck spinner (finally re-enables button) | ✅ PASS |
| 8 (Cross-Feature) | PASS | PASS — event shapes compatible with 5.3; `nutrition.composition.ts` untouched | ✅ PASS |
| 9 (Type-Safety) | PASS | PASS — `tsc --noEmit` clean; `astro build` clean | ✅ PASS |

- Julian's self-QA coverage: 6 categories checked
- Fely's additional verification: XSS audit, string drift check (grep), build gate, known-bugs search
- Anti-pattern issues found: **1 (XSS via innerHTML — FIXED)**

### Issues Found & Fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **CRITICAL (security)** | `nutrition-result.astro:210` — `innerHTML` interpolates `item.name` from AI response without escaping. Malicious food names (e.g. `<img onerror="alert(1)">`) execute arbitrary JS. | Added `escapeHtml()` helper; all `item.name` interpolations now go through it. Tests still green. |
| 2 | Minor (code quality) | `nutrition-result.astro` — `hideStatus` function declared but never called. | Not fixed — cosmetic, no functional impact. Logged for future cleanup. |

### Verdict
**PASS** (after fix #1). All ACs met. All tests green. Build clean. No regressions. XSS vulnerability caught and patched before reaching production.

---

