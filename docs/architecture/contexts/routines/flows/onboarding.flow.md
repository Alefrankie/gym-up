# Onboarding Flow

Parent: [../readme.md](../readme.md) · PRD: [../../../../prd/features/routines.md](../../../../prd/features/routines.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Phase | 2 |
| Last edited | 2026-10-01 |
| Requirements | FR-RT-015, FR-RT-016, FR-RT-005, FR-RT-014 |
| Decisions | [ADR-019 §2–§4](../../../decisions/019-rotation-scheduling-and-onboarding.md) |
| Stories | [8.4](../../../../stories/phase-2/round-8/story-8.4.md) |

## Happy Path

### Step 1 - Entry

The wizard (`/onboarding`, `onboarding-wizard` island) opens when:

| Trigger | How |
|---|---|
| After registration | `/register` redirects to `/dashboard`, which redirects to `/onboarding` because `onboarding_completed_at` is null |
| First login of a Phase 1 user | Same redirect. These users already have an adopted, active program (story 8.1 migration) |
| Ajustes → *Cambiar programa* | Link to `/onboarding?from=settings` |

### Step 2 - Five questions

One single-choice question per step, with progress dots (5), *Atrás* and *Siguiente*. Tapping an option selects it and advances; *Atrás* keeps earlier answers. Options and labels come from `OnboardingOptions`:

| # | Question (UI) | Options |
|---|---|---|
| 1 | ¿Cuál es tu objetivo? | Fuerza · Ganar músculo · Salud y forma general |
| 2 | ¿Cuánta experiencia tienes? | Principiante (menos de 6 meses) · Intermedio (6 meses – 2 años) · Avanzado (más de 2 años) |
| 3 | ¿Cuántos días por semana puedes entrenar? | 2 · 3 · 4 · 5 · 6 |
| 4 | ¿Qué equipo tienes? | Gimnasio completo · Mancuernas · Peso corporal |
| 5 | ¿Algún enfoque? (opcional) | Equilibrado · Glúteos y piernas · Tren superior; *Saltar* = Equilibrado |

The whole questionnaire takes ≤ 30 s (FR-RT-015).

### Step 3 - Submit

After step 5 the island calls `POST /api/onboarding` with `OnboardingAnswers` → `SubmitOnboardingUseCase`: stores `training_goal`, `experience_level`, `days_per_week`, `equipment_profile`, `focus`, `onboarding_completed_at`, then runs `RecommendProgramsUseCase`.

### Step 4 - Recommendation

`recommendPrograms` filters templates by equipment and ranks them with `scoreTemplate` (ADR-019 §3, ties by seed order). The result screen (FR-RT-016) shows:

- **Te recomendamos: {template}** with the reason built from the matched criteria, e.g. "3 días · mancuernas · principiante" (`buildReason`);
- two alternatives as smaller cards;
- *Ver todas las plantillas* → `/train/templates`.

Example: goal `general`, `beginner`, 3 days, `dumbbells`, `balanced` → Dumbbell Full Body 3-Day (40 + 30 + 20 + 15 = 105), then Bodyweight Home 3-Day (30 + 20 + 15 = 65). `full_gym` templates are not eligible.

### Step 5 - Choose

*Empezar con este programa* on any card → `POST /api/templates/[slug]/adopt` with `{ activate: true }` → `AdoptTemplateUseCase` (deep copy + `SetActiveProgramUseCase`). The user lands on `/dashboard`, where the next-workout card shows the first routine of the new program ([next-workout flow](./next-workout.flow.md)). The first session of each exercise shows no load suggestion, only "Elige un peso con el que llegues al rango con 2 reps en reserva" (ADR-019 §4).

---

## Edge Case: Phase 1 user keeps the current program

When `hasActiveProgram` is true, step 1 of the wizard shows *Mantener mi programa actual*. It calls `POST /api/onboarding/dismiss` (sets `onboarding_completed_at`, no answers) and goes to `/dashboard`. On the result screen the same link just goes to `/dashboard` (answers are already stored, nothing is adopted).

## Edge Case: Close the wizard

The close button (×) calls `POST /api/onboarding/dismiss` and goes to `/dashboard`. Without an active program the dashboard shows "Elige tu programa" (FR-RT-014), so the user can come back. Decision: the redirect happens only once (Gravl asks once; the card covers later visits).

## Edge Case: Re-run from Ajustes

`?from=settings` skips the redirect logic and always shows the wizard, prefilled with the stored answers. Adopting a recommended template makes it the new active program; the previous program stays in *Mis programas*, and the rotation starts at day 1 of the new one.

## Edge Case: Back to results

`GET /api/onboarding/recommendations` re-computes the recommendations from the stored answers, so a reload of the results screen does not repeat the questions.

## Failure: Program limit

The user already owns 20 programs: adopt returns 409 `program_limit`. The result screen shows "Tienes 20 programas. Archiva o elimina uno para añadir otro." with a link to `/train`.

## Failure: Submit fails

Network or 5xx on `POST /api/onboarding`: "No se pudieron guardar tus respuestas" with *Reintentar*. Answers stay in the island state.

## Failure: Invalid answer

A value outside `OnboardingOptions` → 400 `validation`. Only reachable by a crafted request.
