---
story_id: "8.4"
round: "round-8"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/routines/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["routines"]
  prd_requirements: ["FR-RT-015", "FR-RT-016", "FR-RT-017"]
  architecture_decisions: ["ADR-019"]
  flows: ["onboarding.flow.md", "adopt-template.flow.md"]
blocked_by: ["story-8.1"]
blocks: ["story-12.5"]
---

# Story 8.4 — Onboarding questionnaire, recommendation & templates browser

Parent: [../readme.md](../readme.md)

## Summary

Adds the Gravl-style program recommendation and the template library on top of the data from story 8.1: a five-step questionnaire (goal, experience, days per week, equipment, focus), a deterministic scoring rule ([ADR-019](../../../architecture/decisions/019-rotation-scheduling-and-onboarding.md) §3) with a human reason sentence, the `/train/templates` browser with preview, and the adopt endpoint that deep-copies a template and activates it. New users and migrated Phase 1 users reach the wizard once from the dashboard; anyone can reopen it from Ajustes. Closes G1 ("onboarding questionnaire → recommended program") and the browsing and adoption side of H14.

## Files in scope

**Modify**

- `src/pages/dashboard.astro` — at the top of the frontmatter, redirects to `/onboarding` when `onboardingCompletedAt` is null. Story 8.3 rewrites the rest of this page, so keep this change to one guard block.
- `src/pages/settings.astro` — adds the link *Cambiar programa* → `/onboarding?from=settings`.
- `src/components/program-list.astro` (created in 8.2) — adds the *Explorar plantillas* entry → `/train/templates`.
- `src/lib/contexts/routines/domain/profile-program-settings.ts` — adds `saveOnboarding` and `markOnboardingCompleted` (declared in 8.1 with `find` and `setActiveProgram` only).
- `src/lib/contexts/routines/infrastructure/sqlite/sqlite-profile-program-settings.ts` and `.../supabase/supabase-profile-program-settings.ts` — implement them.
- `src/lib/contexts/routines/domain/routines.errors.ts` — adds `OnboardingValidationError(issues)` (400) and `NoOnboardingAnswersError` (404).
- `src/lib/contexts/routines/routines.composition.ts` — exports the new use cases.

**Create**

- Domain, `src/lib/contexts/routines/domain/`: `recommendation.ts` (`scoreTemplate`, `recommendPrograms`, `buildReason`), `onboarding-redirect.ts` (`shouldRedirectToOnboarding`).
- Application, `.../application/`: `list-templates.use-case.ts`, `get-template-preview.use-case.ts`, `recommend-programs.use-case.ts`, `submit-onboarding.use-case.ts`, `dismiss-onboarding.use-case.ts`.
- API, `src/pages/api/`: `templates.ts`, `templates/[slug].ts`, `templates/[slug]/adopt.ts`, `onboarding.ts`, `onboarding/dismiss.ts`, `onboarding/recommendations.ts`.
- Pages: `src/pages/onboarding.astro`, `src/pages/train/templates.astro`, `src/pages/train/templates/[slug].astro`.
- Components: `src/components/template-card.astro`, `src/components/onboarding-wizard.tsx` (island).
- Tests listed in the [Test Plan](#test-plan), including `tests/supabase/onboarding-profile.integration.test.ts`.

**Not in scope** (must not change): `db/schema.ts` and migrations (the columns shipped in 7.1 and 8.1), `AdoptTemplateUseCase` and `SetActiveProgramUseCase` (reused as is), the registration form.

## Happy Path

1. A user without `onboarding_completed_at` opens `/dashboard`. The page redirects to `/onboarding` (FR-RT-015). This covers new users after registration and Phase 1 users on their first login; the redirect happens only once.
2. The wizard shows one question per step with progress dots (5), *Atrás* and *Siguiente*: ¿Cuál es tu objetivo?, ¿Cuánta experiencia tienes?, ¿Cuántos días por semana puedes entrenar?, ¿Qué equipo tienes?, ¿Algún enfoque? (optional, *Saltar* = Equilibrado). Tapping an option selects it and advances; *Atrás* keeps earlier answers. Options and labels come from `OnboardingOptions`.
3. After step 5 the island calls `POST /api/onboarding` → `SubmitOnboardingUseCase`: validate, store `training_goal`, `experience_level`, `days_per_week`, `equipment_profile`, `focus`, `onboarding_completed_at`, then recommend.
4. The result screen (FR-RT-016) shows "Te recomendamos: {template}", the reason sentence from `buildReason`, two alternatives as smaller cards and *Ver todas las plantillas* (→ `/train/templates`).
5. *Empezar con este programa* on any card → `POST /api/templates/[slug]/adopt` with `{ activate: true }` → `AdoptTemplateUseCase`. The user lands on `/dashboard`, where the next-workout card shows the first routine of the new program.
6. A migrated user (already has an active program) sees *Mantener mi programa actual* on step 1; it calls `POST /api/onboarding/dismiss` and goes to the dashboard. The close button (×) does the same.
7. From `/train` → *Explorar plantillas* the user sees the 7 templates in seed order (`TemplateCard` with level, goal, "{N} días/semana" and equipment chips), opens `/train/templates/[slug]`, reads the routines and exercises ("{name} · {sets} × {min}–{max} · {rest} s") and taps *Usar plantilla*. A confirmation offers **Activar ahora** (checked) and *Confirmar* (FR-RT-017, FR-RT-005).
8. From Ajustes → *Cambiar programa* the wizard opens at `/onboarding?from=settings`, prefilled with the stored answers; adopting a template makes it the new active program, the previous one stays in *Mis programas*.

## Decisions

- **Scoring runs on the server.** `POST /api/onboarding` returns `{ recommendations, hasActiveProgram }` (context readme). `components.md` says the wizard scores client-side; this story follows the context, so the island contains no scoring code. The docs task fixes `components.md`.
- **Reason text follows `buildReason`, not the example in the PRD.** The rule joins every matched criterion in the order days · equipment · level · goal · focus. For goal `general`, `beginner`, 3 days, `dumbbells`, `balanced` the reason is "3 días · mancuernas · principiante · salud general" (the flow and PRD show the first three items as an "e.g."). With nothing matched the text is `ReasonLabels.fallback`.
- **Chip labels** reuse `ReasonLabels` capitalised (level "Principiante", goal "Hipertrofia", equipment from `OnboardingOptions.equipment`), so there is one source of Spanish terms.
- **After adopting from a template page** the user is redirected to `/train/programs/{newId}?added=1` (and `&active=1` when activated), and the page shows "Programa añadido" and "Ahora es tu programa activo". There is no session flash storage, so the banner is query-driven.
- **Redirect guard** is the pure `shouldRedirectToOnboarding(onboardingCompletedAt, url)`: true when `onboardingCompletedAt` is null and the URL is not `/onboarding`; `?from=settings` never redirects.
- **Registration is unchanged.** The form still asks `routine_type` (it feeds the nutrition hint and the Phase 1 migration); new users have no program, so the dashboard sends them to the wizard.
- **Page link targets.** *Explorar plantillas* appears on `/train` from this story, and the "Elige tu programa" card of story 8.3 starts resolving its links.
- **Offline.** The wizard and the adopt confirmation show "Necesitas conexión para añadir un programa" when the request cannot be sent; cached template pages stay readable only if the service worker (12.3) caches them.
- **Component tests** use happy-dom with `react-dom/client` and `React.createElement` in `.test.ts` files, and a fake `fetch`.

## Acceptance Criteria

- AC-8.4-01: `scoreTemplate` returns `null` for templates outside `EquipmentEligibility` of the answer (filter) and otherwise adds +40 equipment match, `30 − 10 × |days difference|` (not clamped, `days = 2` scored as 3), +20 level, +15 goal and +25 focus only when the answer is not `balanced`; `recommendPrograms` sorts by score descending, breaks ties by `TemplateSeedOrder`, returns at most 3 (1 + 2 alternatives) and fewer when fewer are eligible.
- AC-8.4-02: For goal `general`, `beginner`, 3 days, `dumbbells`, `balanced`, the recommendation is Dumbbell Full Body 3-Day (105) followed by Bodyweight Home 3-Day (65), and no `full_gym` template appears (flow example); for `full_gym`, `advanced`, 6 days, `hypertrophy`, `upper_body` the order is Push Pull Legs 6-Day (105), Male 5-Day Split (100), Female Glute Focus 5-Day (75).
- AC-8.4-03: `buildReason` joins matched criteria in the order days · equipment · level · goal · focus using `ReasonLabels`, and returns the fallback sentence when nothing matched (FR-RT-016).
- AC-8.4-04: `GET /api/templates` returns the 7 templates in seed order with `routineCount` and `Cache-Control: public, max-age=3600`; `GET /api/templates/[slug]` returns routines in `dayNumber` order with exercise name, sets, range and rest, and 404 for an unknown slug; `/train/templates` and `/train/templates/[slug]` render them with the chips ("Plantilla no encontrada" on 404) (FR-RT-017).
- AC-8.4-05: `POST /api/templates/[slug]/adopt` answers 201 `{ program }`, activates by default and honours `{ activate: false }`, answers 409 `program_limit` at 20 owned programs, 404 for an unknown slug, 401 without a session; the template page redirects to `/train/programs/{id}?added=1` with the banners of the Decisions (FR-RT-005).
- AC-8.4-06: `SubmitOnboardingUseCase` validates every answer against `OnboardingOptions` (`focus` defaults to `balanced`), stores the five profile columns and `onboarding_completed_at`, and returns `{ recommendations, hasActiveProgram }`; an invalid value raises `OnboardingValidationError` (400).
- AC-8.4-07: `DismissOnboardingUseCase` sets `onboarding_completed_at` without touching stored answers, is idempotent, and answers 204.
- AC-8.4-08: `GET /api/onboarding/recommendations` recomputes the result from the stored answers and answers 404 `NoOnboardingAnswersError` when there are none, so a reload of the result screen does not repeat the questions.
- AC-8.4-09: The wizard has exactly 5 steps with progress dots, advances on option tap, keeps earlier answers on *Atrás*, treats *Saltar* on step 5 as Equilibrado, submits once after step 5, and renders the recommended card, the reason, two alternatives and *Ver todas las plantillas* (AC-R8-04).
- AC-8.4-10: `/dashboard` redirects to `/onboarding` while `onboardingCompletedAt` is null and stops once the wizard was submitted or dismissed; `/onboarding?from=settings` always shows the wizard prefilled with stored answers and never redirects; a user with an active program sees *Mantener mi programa actual* on step 1; × and *Mantener* call dismiss and go to `/dashboard`.
- AC-8.4-11: End to end on SQLite: a new user without a program completes the wizard, adopts the recommended template and the dashboard then shows an active program whose next routine is the first routine of the adopted copy (AC-R8-04).
- AC-8.4-12: Failure copy: adopt at 20 programs shows "Tienes 20 programas. Archiva o elimina uno para añadir otro." with a link to `/train`; a failed submit shows "No se pudieron guardar tus respuestas" with *Reintentar* and keeps the answers; a failed copy shows "No se pudo añadir el programa" with *Reintentar*; offline shows "Necesitas conexión para añadir un programa".
- AC-8.4-13: Both backends store and read onboarding answers; as a **non-owner** on Supabase a user cannot update another user's onboarding columns (the `profiles` own-row policy), and `SupabaseProfileProgramSettings` writes only the caller's row.
- AC-8.4-14: Ajustes shows *Cambiar programa* linking to `/onboarding?from=settings`, and `/train` shows *Explorar plantillas* linking to `/train/templates`.

## Tasks

- [ ] `T8.4-01` - `recommendation.ts` (`scoreTemplate`, `recommendPrograms`, `buildReason`) with table-driven tests over the seven seeded templates.
- [ ] `T8.4-02` - `onboarding-redirect.ts` and tests.
- [ ] `T8.4-03` - Extend `ProfileProgramSettings` (`saveOnboarding`, `markOnboardingCompleted`) in both backends; add `OnboardingValidationError` and `NoOnboardingAnswersError`.
- [ ] `T8.4-04` - `ListTemplatesUseCase` and `GetTemplatePreviewUseCase` with tests.
- [ ] `T8.4-05` - `RecommendProgramsUseCase`, `SubmitOnboardingUseCase`, `DismissOnboardingUseCase` with tests (injected `now`).
- [ ] `T8.4-06` - Composition exports and the template and onboarding endpoints (JSON errors, auth, cache header).
- [ ] `T8.4-07` - `template-card.astro`, `/train/templates`, `/train/templates/[slug]` with the *Usar plantilla* confirmation and banners; *Explorar plantillas* in `program-list.astro`.
- [ ] `T8.4-08` - `onboarding-wizard.tsx` and `/onboarding` page (steps, prefill, dismiss, result, adopt, failures).
- [ ] `T8.4-09` - Dashboard redirect guard and the settings link.
- [ ] `T8.4-10` - End-to-end SQLite test and the Supabase profile integration test.
- [ ] `T8.4-11` - Run both backends and `typecheck`; Phase 1 regression test.
- [ ] `T8.4-12` - Update docs: mark use cases 19–23 `implemented`, fix the client-side-scoring line of `components.md` and the reason example of the onboarding flow, add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/routines/recommendation.test.ts` | unit, table-driven | Filter, scoring terms, days = 2, negative days term, focus rule, ties, limit of 3, reason order (01, 02, 03) |
| `tests/routines/onboarding-redirect.test.ts` | unit, table-driven | Guard decisions per URL and completion state (10) |
| `tests/routines/list-templates.use-case.test.ts`, `get-template-preview.use-case.test.ts` | use-case | Seed order, counts, preview content, not found (04) |
| `tests/routines/submit-onboarding.use-case.test.ts` | use-case | Validation, defaults, storage, result (06) |
| `tests/routines/dismiss-onboarding.use-case.test.ts` | use-case | Completed flag, answers untouched, idempotent (07) |
| `tests/routines/recommend-programs.use-case.test.ts` | use-case | Stored answers, none → error (08) |
| `tests/routines/sqlite-profile-program-settings.test.ts` | repo | `saveOnboarding`, `markOnboardingCompleted`, `find` shape (06, 07, 13) |
| `tests/routines/templates-route-handlers.test.ts`, `onboarding-route-handlers.test.ts` | unit | Status codes, headers, adopt options, limit (04, 05, 07, 08) |
| `tests/routines/onboarding-wizard.test.ts` | component (happy-dom) | Steps, skip, back, result, mantener, close, failures, offline (09, 10, 12) |
| `tests/routines/onboarding-flow.test.ts` | integration (real SQLite) | New user → wizard → adopt → next routine (11) |
| `tests/supabase/onboarding-profile.integration.test.ts` | integration-RLS | Non-owner cannot write another profile's onboarding columns (13) |

Worked examples (table tests):

| Answers (goal, experience, days, equipment, focus) | Template scores (eligible only) | Recommended + alternatives |
|---|---|---|
| general, beginner, 3, dumbbells, balanced | Dumbbell Full Body 105, Bodyweight Home 65 | Dumbbell Full Body 3-Day, Bodyweight Home 3-Day |
| hypertrophy, advanced, 6, full_gym, upper_body | Push Pull Legs 105, Male 5-Day 100, Female Glute 75, Upper / Lower 50, Full Body Beginner 40, Dumbbell 0, Bodyweight 0 | Push Pull Legs 6-Day, Male 5-Day Split, Female Glute Focus 5-Day |
| general, beginner, 2, full_gym, balanced | Full Body Beginner 105 (days term treated as 3) | Full Body Beginner 3-Day first |
| general, beginner, 3, bodyweight, balanced | Bodyweight Home 105 (only eligible template) | Bodyweight Home 3-Day alone |

| `buildReason` matched criteria | Text |
|---|---|
| days, equipment, level, goal | "3 días · mancuernas · principiante · salud general" |
| equipment, level | "gimnasio completo · principiante" |
| none | "lo más parecido a lo que buscas" |

## Out of Scope

- The adopted program's builder and management screens — story [8.2](./story-8.2.md).
- The next-workout dashboard card that the user lands on — story [8.3](./story-8.3.md).
- Load suggestions for the first sessions ("Elige un peso con el que llegues al rango con 2 reps en reserva") — story 10.2.
- Removing `routine_type` from the registration form — not planned (it still feeds nutrition hints).
- Service-worker caching of template pages — story 12.3.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
