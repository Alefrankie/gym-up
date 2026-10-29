// src/lib/contexts/nutrition/domain/nutrition-entry-repository.ts
//
// Abstract contract for nutrition entry persistence.
//
// Per ADR-005: nutrition entries are private (owner-only).
// Per ADR-007 + ADR-011: abstract class (not interface) for TS-native
// contract; concrete classes `implements` this.

import type { NutritionEntry, NutritionEntryCreateDTO } from './nutrition.types';

/**
 * Thrown when a nutrition entry belongs to a different user.
 * Maps to HTTP 403 (forbidden) — do not leak existence (ADR-005).
 */
export class NutritionEntryOwnershipError extends Error {
  constructor(
    public readonly entryId: string,
    public readonly currentUserId: string,
  ) {
    super(
      `Nutrition entry ${entryId} does not belong to user ${currentUserId}`,
    );
    this.name = 'NutritionEntryOwnershipError';
  }
}

export abstract class NutritionEntryRepository {
  /**
   * Look up an entry by id. Owner-only — throws `NutritionEntryOwnershipError`
   * if the entry belongs to a different user.
   */
  abstract findById(
    id: string,
    currentUserId: string,
  ): Promise<NutritionEntry | undefined>;

  /**
   * List all nutrition entries for a user, newest first.
   */
  abstract findByUser(userId: string): Promise<NutritionEntry[]>;

  /**
   * List nutrition entries for a user within a date range (inclusive start,
   * exclusive end). Used for daily summary.
   *
   * @param startMs - start of window (inclusive, timestamp_ms)
   * @param endMs   - end of window (exclusive, timestamp_ms)
   */
  abstract findByDateRange(
    userId: string,
    startMs: number,
    endMs: number,
  ): Promise<NutritionEntry[]>;

  /**
   * Create a nutrition entry. `currentUserId` is the owner; the row's userId
   * is set from this value (defense in depth).
   */
  abstract create(
    input: NutritionEntryCreateDTO,
    currentUserId: string,
  ): Promise<NutritionEntry>;

  /**
   * Delete a nutrition entry (and its file on disk in the SQLite impl).
   * Owner-only.
   */
  abstract delete(id: string, currentUserId: string): Promise<void>;
}
