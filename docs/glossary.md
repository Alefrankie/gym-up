# Glossary

Parent: [./readme.md](../README.md)

Domain terms used across documentation.

## A

| Term | Definition | Canonical home |
|------|------------|----------------|
| ADR | Architecture Decision Record. Documents a significant architectural decision. | [architecture/decisions/readme.md](./architecture/decisions/readme.md) |
| Adapter | Concrete class that implements a domain port. Lives in infrastructure layer. | [architecture/decisions/007-repository-pattern.md](./architecture/decisions/007-repository-pattern.md) |
| Auth | Authentication. Supabase Auth with email/password. | [architecture/contexts/auth/readme.md](./architecture/contexts/auth/readme.md) |

## C

| Term | Definition | Canonical home |
|------|------------|----------------|
| Calories | Energy unit for nutrition. Measured in kcal. | [architecture/contexts/nutrition/readme.md](./architecture/contexts/nutrition/readme.md) |
| Completed | Workout status. Requires ≥1 entry. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |
| Composition Root | Per-context file that wires concrete adapters to abstract ports. | [architecture/decisions/010-per-context-composition.md](./architecture/decisions/010-per-context-composition.md) |

## D

| Term | Definition | Canonical home |
|------|------------|----------------|
| Domain | Business rules, invariants, entities, value objects. | [architecture/contexts/readme.md](./architecture/contexts/readme.md) |
| DTO | Data Transfer Object. Shape of data passed between layers. | [architecture/contexts/*/readme.md](./architecture/contexts/) |

## E

| Term | Definition | Canonical home |
|------|------------|----------------|
| Entity | Domain object with identity. Has `id` field. | [architecture/contexts/*/readme.md](./architecture/contexts/) |
| Exercise | A specific gym movement. Has `name`, `muscle_group`. | [architecture/database-schema.md](./architecture/database-schema.md) |

## F

| Term | Definition | Canonical home |
|------|------------|----------------|
| Flow | End-to-end behavior across UI, application, domain, persistence. Files use `.flow.md`. | [architecture/contexts/*/flows/](./architecture/contexts/) |
| FR | Functional Requirement. Tracked in PRD features. | [prd/features/requirements-index.md](./prd/features/requirements-index.md) |

## H

| Term | Definition | Canonical home |
|------|------------|----------------|
| Hexagonal Architecture | Ports and adapters pattern. Domain at center, adapters at edges, wired by composition. | [architecture/decisions/013-hexagonal-architecture.md](./architecture/decisions/013-hexagonal-architecture.md) |
| Hombre | Male routine type. One of two valid values. | [architecture/database-schema.md](./architecture/database-schema.md) |

## I

| Term | Definition | Canonical home |
|------|------------|----------------|
| Infrastructure | Adapters, endpoints, DTOs, persistence. Implements domain ports. | [architecture/contexts/readme.md](./architecture/contexts/readme.md) |
| Invariant | Business rule that MUST always be true. | [architecture/contexts/*/readme.md](./architecture/contexts/) |
| In Progress | Workout status. Initial state when workout started. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |

## K

| Term | Definition | Canonical home |
|------|------------|----------------|
| kg | Kilograms. Internal weight storage unit. | [architecture/decisions/006-kg-storage.md](./architecture/decisions/006-kg-storage.md) |

## L

| Term | Definition | Canonical home |
|------|------------|----------------|
| lbs | Pounds. Display unit for users who prefer imperial. | [architecture/decisions/006-kg-storage.md](./architecture/decisions/006-kg-storage.md) |

## M

| Term | Definition | Canonical home |
|------|------------|----------------|
| Macros | Macronutrients: protein, carbs, fat. Measured in grams. | [architecture/contexts/nutrition/readme.md](./architecture/contexts/nutrition/readme.md) |
| Mujer | Female routine type. One of two valid values. | [architecture/database-schema.md](./architecture/database-schema.md) |

## N

| Term | Definition | Canonical home |
|------|------------|----------------|
| NFR | Non-Functional Requirement. | [prd/features/requirements-index.md](./prd/features/requirements-index.md) |
| NutritionEntry | One analyzed meal. Has calories, macros, food items. | [architecture/contexts/nutrition/readme.md](./architecture/contexts/nutrition/readme.md) |

## P

| Term | Definition | Canonical home |
|------|------------|----------------|
| Port | Interface defined in domain. Implemented by infrastructure adapters. | [architecture/contexts/*/readme.md](./architecture/contexts/) |
| Profile | User profile. Has display_name, routine_type, weight_unit. | [architecture/contexts/user/readme.md](./architecture/contexts/user/readme.md) |
| ProgressPhoto | Private photo for tracking body progress. | [architecture/contexts/private-photos/readme.md](./architecture/contexts/private-photos/readme.md) |

## R

| Term | Definition | Canonical home |
|------|------------|----------------|
| RLS | Row Level Security. Supabase feature for data isolation. | [architecture/database-schema.md](./architecture/database-schema.md) |
| Routine | Predefined workout template. 5 days, each with exercises. | [architecture/database-schema.md](./architecture/database-schema.md) |
| RoutineDay | One day of a routine. Has day_number, day_name, focus. | [architecture/database-schema.md](./architecture/database-schema.md) |
| RoutineExercise | Exercise in a routine day. Has target_sets, target_reps. | [architecture/database-schema.md](./architecture/database-schema.md) |

## S

| Term | Definition | Canonical home |
|------|------------|----------------|
| Seed Data | Pre-populated data in DB. Routines and exercises. | [architecture/decisions/003-routines-seed-data.md](./architecture/decisions/003-routines-seed-data.md) |
| Set | One group of repetitions of an exercise. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |
| Signed URL | Temporary secure URL for private storage files. Expires in 1 hour. | [architecture/contexts/private-photos/readme.md](./architecture/contexts/private-photos/readme.md) |
| Streak | Consecutive days with completed workouts. | [architecture/contexts/progress/readme.md](./architecture/contexts/progress/readme.md) |

## U

| Term | Definition | Canonical home |
|------|------------|----------------|
| Use Case | Single business action in the application layer. Orchestrates domain and ports. | [architecture/contexts/readme.md](./architecture/contexts/readme.md) |

## V

| Term | Definition | Canonical home |
|------|------------|----------------|
| Value Object | Domain object without identity. Defined by its values. | [architecture/contexts/*/readme.md](./architecture/contexts/) |
| Volume | Total weight lifted. Calculated: sets × reps × weight. | [architecture/contexts/progress/readme.md](./architecture/contexts/progress/readme.md) |

## W

| Term | Definition | Canonical home |
|------|------------|----------------|
| WeightUnit | User preference: 'kg' or 'lbs'. | [architecture/decisions/006-kg-storage.md](./architecture/decisions/006-kg-storage.md) |
| Workout | One gym session. Has status, date, entries. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |
| WorkoutEntry | One set of one exercise in a workout. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |
