// src/lib/contexts/public-view/domain/public-profile.repository.ts
//
// Abstract port for reading profiles in the public view context.
// Per ADR-007: abstract class as port, concrete impl in infrastructure/.
// Per ADR-004: read-all — all authenticated users can read all profiles.
// Per golden-rules (Cross-Context Isolation): this repo reads directly
// from the profiles table via SQL, NOT via ProfileRepository from auth context.

import type { MemberCard, PublicRoutineType } from './member';

/**
 * Minimal profile row for public-view consumption.
 * Email is intentionally excluded (FR-PV-003).
 */
export interface PublicProfileRow {
  id: string;
  displayName: string;
  routineType: PublicRoutineType;
}

export abstract class PublicProfileRepository {
  /**
   * Fetch all profiles. Returns minimal fields needed for member cards.
   * No ownership guard — ADR-004 allows read-all.
   */
  abstract getAll(): Promise<PublicProfileRow[]>;

  /**
   * Fetch a single profile by ID.
   * Returns undefined if not found (per golden-rules: find* returns T | undefined).
   */
  abstract getById(id: string): Promise<PublicProfileRow | undefined>;
}
