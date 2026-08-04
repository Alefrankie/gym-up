// tests/progress/test-db.ts
//
// Re-export of the workout-tracking test-db. The progress context's
// SQLite repos read from the same tables (workouts, workout_entries,
// exercises) — so the schema is identical. We just share the harness.
//
// Per cross-context isolation: the progress tests do NOT import any
// workout-tracking repository; they insert directly into the schema
// tables (same pattern as workout-tracking tests).

export {
  createTestDb,
  type TestDb,
  type TestDbHandle,
} from '../workout-tracking/test-db';
