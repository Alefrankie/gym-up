// tests/workout-tracking/update-profile.use-case.test.ts
//
// AC-4.3-01: update display name.
// AC-4.3-02: switch routine type.
// AC-4.3-03: toggle weight unit (stored kg internally, ADR-006).
// AC-4.3-04: logout (covered by /logout route, not this use case — kept here for context).
//
// Use case contract:
//   1. Accepts Partial<Pick<Profile, 'displayName'|'routineType'|'weightUnit'>>.
//   2. Validates displayName (non-empty after trim, max 100 chars).
//   3. Validates routineType ∈ {'hombre','mujer'} if provided.
//   4. Validates weightUnit ∈ {'kg','lbs'} if provided.
//   5. Calls repo.update(userId, patch) and returns the updated Profile.
//   6. Throws typed errors for validation failures.
//   7. Throws ProfileNotFoundError (from repo) if userId does not exist.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { UpdateProfileUseCase } from '@/lib/contexts/workout-tracking/application/update-profile.use-case';
import { SqliteProfileRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository';
import { createTestDb, type TestDbHandle } from './test-db';
import { profiles } from '@db/schema';

let handle: TestDbHandle;
let repo: SqliteProfileRepository;
let useCase: UpdateProfileUseCase;
let userId: string;

beforeAll(async () => {
  handle = createTestDb();
  repo = new SqliteProfileRepository(handle.db);
  useCase = new UpdateProfileUseCase(repo);

  const [u] = await handle.db
    .insert(profiles)
    .values({
      email: 'settings@example.com',
      passwordHash: 'hashed_password',
      displayName: 'Original Name',
      routineType: 'hombre',
      weightUnit: 'kg',
    })
    .returning();
  userId = u.id;
});

afterAll(() => {
  handle.close();
});

describe('UpdateProfileUseCase — happy path', () => {
  it('updates all three fields at once', async () => {
    const updated = await useCase.execute({
      userId,
      displayName: 'Updated Name',
      routineType: 'mujer',
      weightUnit: 'lbs',
    });

    expect(updated.displayName).toBe('Updated Name');
    expect(updated.routineType).toBe('mujer');
    expect(updated.weightUnit).toBe('lbs');
    expect(updated.id).toBe(userId);
  });

  it('returns the persisted profile', async () => {
    const updated = await useCase.execute({
      userId,
      displayName: 'Persisted Check',
    });
    expect(updated.id).toBe(userId);
    expect(updated.displayName).toBe('Persisted Check');
  });

  it('supports partial updates (only weightUnit)', async () => {
    const before = await repo.findById(userId);
    const updated = await useCase.execute({
      userId,
      weightUnit: 'kg',
    });
    expect(updated.weightUnit).toBe('kg');
    // Other fields unchanged
    expect(updated.displayName).toBe(before?.displayName);
    expect(updated.routineType).toBe(before?.routineType);
  });
});

describe('UpdateProfileUseCase — validation', () => {
  it('rejects empty displayName (typed error)', async () => {
    await expect(
      useCase.execute({ userId, displayName: '' }),
    ).rejects.toThrow(/displayName|empty|required/i);
  });

  it('rejects whitespace-only displayName', async () => {
    await expect(
      useCase.execute({ userId, displayName: '   ' }),
    ).rejects.toThrow(/displayName|empty|required/i);
  });

  it('rejects displayName longer than 100 chars', async () => {
    await expect(
      useCase.execute({ userId, displayName: 'a'.repeat(101) }),
    ).rejects.toThrow(/displayName|too long|max|100/i);
  });

  it('accepts displayName of 100 chars (boundary)', async () => {
    const name = 'a'.repeat(100);
    const updated = await useCase.execute({ userId, displayName: name });
    expect(updated.displayName).toBe(name);
  });

  it('rejects invalid routineType', async () => {
    await expect(
      useCase.execute({
        userId,
        // @ts-expect-error — intentionally invalid to test runtime guard
        routineType: 'invalid_value',
      }),
    ).rejects.toThrow(/routineType|invalid/i);
  });

  it('rejects invalid weightUnit', async () => {
    await expect(
      useCase.execute({
        userId,
        // @ts-expect-error — intentionally invalid to test runtime guard
        weightUnit: 'stones',
      }),
    ).rejects.toThrow(/weightUnit|invalid/i);
  });
});

describe('UpdateProfileUseCase — not found', () => {
  it('throws ProfileNotFoundError for unknown userId', async () => {
    await expect(
      useCase.execute({
        userId: '00000000-0000-0000-0000-000000000000',
        displayName: 'Ghost',
      }),
    ).rejects.toThrow(/not found|ProfileNotFound/i);
  });
});
