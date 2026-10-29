# Feature — Progression (Coach)

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Architecture Links

- Context: [architecture/contexts/progression/readme.md](../../architecture/contexts/progression/readme.md)
- Decisions: [ADR-021](../../architecture/decisions/021-progression-engine.md), [ADR-022](../../architecture/decisions/022-readiness-and-recovery.md), [ADR-020](../../architecture/decisions/020-personal-records.md)
- Stories: [Round 10](../../stories/phase-2/round-10/readme.md)

Phase 2. The Gravl part of gym-up: the app tells you what to lift, notices when you stall, schedules deloads, and adapts the session to how you feel. All rules are deterministic and explainable.

---

## Functional Requirements

### Load Suggestions

#### FR-PG-001

When a workout loads, each exercise with ≥ 1 previous exposure gets a **suggestion** `{ weight, reps, sets, reason }` computed by double progression ([ADR-021 §3](../../architecture/decisions/021-progression-engine.md)). The live workout shows it as a chip under the exercise name ("Sugerido: 62.5 kg × 8") and uses it to prefill the sets ([FR-WT-030](./workout-tracking.md#fr-wt-030)).

#### FR-PG-002

Tapping the chip shows **¿Por qué?** with a plain-language explanation built from the reason code and the last exposure, e.g. "La última vez hiciste 12, 12 y 12 reps con 60 kg (tope del rango 8–12). Subimos 2.5 kg."

#### FR-PG-003

Double-progression rules exactly as in [ADR-021 §3](../../architecture/decisions/021-progression-engine.md), including rep-only and duration types.

#### FR-PG-004

Increments by equipment and muscle, unit-native steps for lbs users, plate rounding (bar exercises) and safety caps, per [ADR-021 §4](../../architecture/decisions/021-progression-engine.md).

#### FR-PG-005

First exposure (no history): no suggestion. The chip reads "Primera vez: elige un peso con el que llegues a {min}–{max} reps con 2 en reserva" ([ADR-019 §4](../../architecture/decisions/019-rotation-scheduling-and-onboarding.md)).

### Plateaus

#### FR-PG-006

Plateau detection per [ADR-021 §5](../../architecture/decisions/021-progression-engine.md). A plateaued exercise shows an amber "Estancado" marker on its chip in the live workout, on the exercise detail and in the dashboard list "Ejercicios estancados" (when ≥ 1).

#### FR-PG-007

The plateau sheet offers **Bajar y reconstruir**, **Cambiar rango** (4 weeks) and **Ignorar** (2 exposures) ([ADR-021 §5](../../architecture/decisions/021-progression-engine.md)). The choice is stored in `exercise_progression_overrides`.

### Deload

#### FR-PG-008

When the deload conditions hold ([ADR-021 §6](../../architecture/decisions/021-progression-engine.md)), the dashboard shows a card "Semana de descarga recomendada" with the reason and two actions:

- **Empezar descarga**: sets `deload_until = today + 7`, `last_deload_at = today`;
- **Ahora no**: hides the card for 7 days.

During a deload, workouts show a "Descarga" badge and the reduced suggestions. Settings shows "Descarga activa hasta {date}" with *Terminar descarga*.

### Readiness

#### FR-PG-009

After *Empezar* (if `readiness_enabled`), a readiness step asks the 3 questions of [ADR-022 §1](../../architecture/decisions/022-readiness-and-recovery.md) with 1–5 sliders, and offers *Saltar*. It lists fatigued muscles hit by the chosen routine (if any) and offers "Elegir otra rutina".

#### FR-PG-010

Readiness adjustments per [ADR-022 §1](../../architecture/decisions/022-readiness-and-recovery.md). The adjustment is shown in the header ("Sesión ajustada: −1 serie") and can be reverted with *Usar plan original*.

### Recovery & Warnings

#### FR-PG-011

The dashboard **Recuperación** widget shows each muscle trained in the last 7 days with its recovery % and state (fresh / recovering / fatigued), per [ADR-022 §2](../../architecture/decisions/022-readiness-and-recovery.md). It renders as a front/back body silhouette heat map on ≥ 400 px and as a list on smaller screens.

#### FR-PG-012

Soft warnings per [ADR-022 §3](../../architecture/decisions/022-readiness-and-recovery.md). They are dismissible and never block an action.

### Control

#### FR-PG-013

`progression_enabled = false` hides chips, plateau markers and deload cards, and prefill falls back to *Anterior* (pure Hevy mode). `readiness_enabled = false` skips FR-PG-009.

---

## Data

| Table | Access |
|-------|--------|
| `workouts`, `workout_exercises`, `workout_entries` | Read own (history input) |
| `routine_exercises` | Read (targets) |
| `exercises` | Read (equipment, type, muscles) |
| `exercise_progression_overrides` | Owner-only CRUD |
| `readiness_checkins` | Owner-only CRUD ([ADR-022](../../architecture/decisions/022-readiness-and-recovery.md)) |
| `profiles` | `deload_until`, `last_deload_at`, `progression_enabled`, `readiness_enabled`: write own |

## Components

| Component | Spec |
|-----------|------|
| `SuggestionChip`, `SuggestionWhySheet` | [components.md → Progression](../../architecture/components.md#progression) |
| `PlateauSheet`, `DeloadCard` | [components.md → Progression](../../architecture/components.md#progression) |
| `ReadinessStep` | [components.md → Progression](../../architecture/components.md#progression) |
| `RecoveryWidget` | [components.md → Progression](../../architecture/components.md#progression) |
