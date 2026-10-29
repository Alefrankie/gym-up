// tests/public-view/test-db.ts
//
// Re-export of the shared test DB harness.
// Public-view tests insert directly into schema tables (cross-context isolation).

export {
  createTestDb,
  type TestDb,
  type TestDbHandle,
} from '../workout-tracking/test-db';
