// src/lib/contexts/progress/domain/ports/ExerciseQueryRepository.ts
//
// Abstract port for fetching exercises the user has actually logged.
// Per docs/architecture/contexts/progress/readme.md "Ports" section.
//
// Per architecture invariant: "Exercise selector shows ONLY exercises
// the user has actually logged." → the SQL JOINs through workout_entries
// filtered by user_id + status='completed'.
//
// Per golden-rules (Cross-Context Isolation): the SQLite impl queries
// the `exercises` table directly. It does NOT import workout-tracking
// repositories. The bounded context owns its own read model.
//
// Returned type re-exports the schema's `Exercise` to keep the import
// surface narrow (only this port + the SQLite adapter import from
// `@db/schema` — the application + UI layers consume `Exercise` via
// the port's return type).

import type { Exercise } from '@db/schema';

export abstract class ExerciseQueryRepository {
  /**
   * Return the distinct exercises the user has logged in any
   * completed workout, ordered by name ASC.
   */
  abstract getLoggedExercises(userId: string): Promise<Exercise[]>;
}
