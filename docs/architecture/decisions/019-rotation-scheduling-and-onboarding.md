---
id: ADR-019
title: Rotation Scheduling and Rule-Based Program Recommendation
type: decision
status: accepted
date: 2026-10-01
---

# ADR-019: Rotation Scheduling and Rule-Based Program Recommendation

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

## Status

Accepted. Resolves [OQ-003](../../planning/open-questions.md) (routine change mid-week).

## Context

Phase 1 maps `routine_days.day_number` to the weekday (1 = Monday). Weekends are rest days and a missed Monday is lost. Hevy has no schedule (you pick a routine). Gravl always shows "your next workout" and moves on when you train. Users who miss a day or train on Saturday break the weekday model.

## Decision

### 1. Rotation, not weekday

The **next routine** of the active program is the one after the last *completed* workout that belongs to that program, cyclically by `day_number`:

```
last = latest completed workout where program_id = active_program_id
       and completed_at > program.rotation_anchor_at
next = routine_days ordered by day_number, first with day_number > last.day_number, else the first
```

If no workout belongs to the program yet, `next` is `day_number = 1`.

- The dashboard shows **"Siguiente: <routine name>"** with a primary *Empezar* button, plus an **"Elegir otra rutina"** list (any routine of the active program) and **"Entrenamiento libre"** (Hevy empty workout).
- There are no rest-day screens and no weekday binding. Rest guidance comes from recovery ([ADR-022](./022-readiness-and-recovery.md)).
- Changing the active program mid-week (OQ-003), or reordering its routines, sets `routines.rotation_anchor_at = now`, which restarts the rotation at day 1. Past workouts are untouched.

### 2. Onboarding questionnaire (Gravl)

On the first login after Phase 2 (or at registration), and later from Settings → "Cambiar programa", the user answers:

| Question | Options |
|---|---|
| Objetivo | `strength`, `hypertrophy`, `general` |
| Experiencia | `beginner` (< 6 months), `intermediate` (6 months – 2 years), `advanced` (> 2 years) |
| Días por semana | 2, 3, 4, 5, 6 |
| Equipo | `full_gym`, `dumbbells`, `bodyweight` |
| Enfoque (optional) | `balanced`, `glutes_legs`, `upper_body` |

Answers are stored on `profiles` (`training_goal`, `experience_level`, `days_per_week`, `equipment_profile`, `focus`, `onboarding_completed_at`).

### 3. Recommendation rule (deterministic)

**Filter:** a template is eligible only if it fits the user's equipment:

- `full_gym` → every template is eligible;
- `dumbbells` → templates with `equipment_profile` `dumbbells` or `bodyweight`;
- `bodyweight` → `bodyweight` templates only.

**Score** each eligible template `t` and recommend the highest. Ties are broken by template seed order.

```
score = 0
if t.equipment_profile == answer.equipment          → +40
score += 30 − 10 × |t.days_per_week − answer.days|
if t.level == answer.experience                     → +20
if t.goal == answer.goal                            → +15
if answer.focus ≠ 'balanced' and t.focus == answer.focus → +25
if answer.days == 2                                 → treat as 3 for the days term
```

The user sees the top recommendation plus two alternatives, and may browse every template. Adopting a template copies it ([ADR-018](./018-user-owned-programs.md)) and sets it active.

### 4. Starting weights (Gravl)

For an adopted program with no history, the first session of each exercise shows **no suggestion**, only the hint "Elige un peso con el que llegues al rango con 2 reps en reserva". Suggestions start after the first exposure ([ADR-021](./021-progression-engine.md)). No body-weight-ratio guessing: it is unreliable for beginners.

## Rationale

- Rotation matches how families actually train (irregular days) and removes the rest-day picker.
- A transparent score is explainable ("Te recomendamos X porque entrenas 3 días con mancuernas").

## Trade-offs

- **Pro:** No calendar logic, no lost days.
- **Con:** No "Monday is chest" guarantee. Users who want that can still pick the routine manually.

## Consequences

- `GetTodayWorkoutUseCase` is replaced by `GetNextWorkoutUseCase` (routines context) in [story-8.3](../../stories/phase-2/round-8/story-8.3.md).
- FR-WT-005 and FR-WT-014 are superseded by FR-RT-010..FR-RT-013.
- Template metadata columns live in [ADR-018](./018-user-owned-programs.md).

## Referenced by

- [routines PRD](../../prd/features/routines.md)
- [routines context](../contexts/routines/readme.md)
