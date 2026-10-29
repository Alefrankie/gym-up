# Adopt Template Flow

Parent: [../readme.md](../readme.md) · PRD: [../../../../prd/features/routines.md](../../../../prd/features/routines.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Phase | 2 |
| Last edited | 2026-10-01 |
| Requirements | FR-RT-005, FR-RT-017, FR-RT-004 |
| Decisions | [ADR-018 §2](../../../decisions/018-user-owned-programs.md), [ADR-019 §4](../../../decisions/019-rotation-scheduling-and-onboarding.md) |
| Data | [Program Templates Seed](../../../database-schema.md#program-templates-seed) |
| Stories | [8.1](../../../../stories/phase-2/round-8/story-8.1.md) (copy), [8.4](../../../../stories/phase-2/round-8/story-8.4.md) (browser) |

## Happy Path

### Step 1 - Templates list

`/train` → *Explorar plantillas* → `/train/templates` (SSR, `ListTemplatesUseCase`). The 7 templates appear in seed order as `TemplateCard`s: name and chips for level ("Principiante"), goal, "{N} días/semana" and equipment.

### Step 2 - Preview

Tapping a card → `/train/templates/[slug]` (SSR, `GetTemplatePreviewUseCase`). The page shows the description, the chips, and every routine in rotation order with its exercises as "{name} · {sets} × {min}–{max} · {rest} s".

### Step 3 - Usar plantilla

*Usar plantilla* opens a confirmation with the checkbox **Activar ahora** (checked by default, FR-RT-005) and *Confirmar*.

### Step 4 - Deep copy

`POST /api/templates/[slug]/adopt` with `{ activate }` → `AdoptTemplateUseCase`:

1. Program limit check (20).
2. `ProgramRepository.adoptTemplate(templateId, userId)`: one transaction (SQLite) or `adopt_template(p_user, p_template)` (Supabase). It copies the program (`owner_id = me`, `source_template_id = template`, `is_template = false`, `slug = NULL`, level/goal/days/equipment/focus kept), every routine with the same `day_number`, `day_name`, `focus` and `notes`, and every routine exercise with all its targets.
3. If `activate`: `SetActiveProgramUseCase` sets `profiles.active_program_id` and the rotation anchor.

### Step 5 - Result

`201 { program }`. The user lands on `/train/programs/[newId]` with "Programa añadido" (and "Ahora es tu programa activo" when activated). The copy is fully editable ([build-routine flow](./build-routine.flow.md)); the template never changes.

---

## Edge Case: Do not activate

With *Activar ahora* unchecked the copy is created and the active program stays the same. The user can activate it later from `/train` (FR-RT-004).

## Edge Case: Adopt the same template twice

Allowed: a second independent copy with the same name. Decision: Hevy allows saving the same routine several times.

## Edge Case: First sessions

Exercises of the adopted program show no load suggestion on their first session, only the hint "Elige un peso con el que llegues al rango con 2 reps en reserva" (ADR-019 §4).

## Edge Case: Template from onboarding

The onboarding result cards call the same endpoint with `activate: true` ([onboarding flow](./onboarding.flow.md) step 5).

## Edge Case: Phase 1 templates

`male-5-day-split` and `female-glute-focus-5-day` are the Phase 1 routines turned into templates in place. Phase 1 workouts keep pointing at their routines; adopting creates a new copy, so history is untouched.

## Failure: Program limit

409 `program_limit` → "Tienes 20 programas. Archiva o elimina uno para añadir otro."

## Failure: Unknown slug

`/train/templates/[slug]` or the adopt endpoint with an unknown slug → 404 "Plantilla no encontrada".

## Failure: Copy fails mid-way

The copy is atomic (transaction / SQL function): on any error nothing is created and the user sees "No se pudo añadir el programa" with *Reintentar*. If activation fails after a successful copy, the program exists inactive and the message suggests activating it from `/train`.

## Failure: Offline

*Usar plantilla* offline: "Necesitas conexión para añadir un programa". The cached template pages stay readable.
