// src/lib/contexts/workout-tracking/domain/profile.repository.ts
//
// Abstract contract for profile persistence. Components and use cases
// depend on this class, never on a concrete implementation.
//
// Per ADR-007: abstract class (not interface) for TS-native contract.
// Per ADR-011: concrete classes `implements` this; they do not `extend` it.

import type { Profile, NewProfile } from '@db/schema';

export abstract class ProfileRepository {
  /**
   * Look up a profile by its primary key.
   * Returns `undefined` if not found (per golden-rules: find* → T | undefined).
   */
  abstract findById(id: string): Promise<Profile | undefined>;

  /**
   * Look up a profile by its email (used by the auth flow).
   */
  abstract findByEmail(email: string): Promise<Profile | undefined>;

  /**
   * Persist a new profile. Throws on conflict (e.g. duplicate id/email).
   */
  abstract create(input: NewProfile): Promise<Profile>;

  /**
   * Update display_name / routine_type / weight_unit. Returns the updated
   * row, or throws if the profile does not exist.
   */
  abstract update(
    id: string,
    patch: Partial<Pick<Profile, 'displayName' | 'routineType' | 'weightUnit'>>,
  ): Promise<Profile>;
}
