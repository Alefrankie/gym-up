// src/lib/contexts/workout-tracking/application/update-profile.use-case.ts
//
// Use case: update the current user's profile (displayName, routineType,
// weightUnit). Per FR-WT-016. Triggered from /settings (PRG).
//
// Validation:
//   - displayName: trim() non-empty, max ProfileRules.MaxDisplayNameLength.
//   - routineType: enum guard (`'hombre' | 'mujer'`).
//   - weightUnit: enum guard (`'kg' | 'lbs'`).
//
// Persistence: delegates to ProfileRepository.update which already enforces
// the partial-patch shape (Partial<Pick<Profile, ...>>).
//
// Error model: typed errors thrown BEFORE reaching the repo. The repo
// itself throws `Error("Profile not found: ...")`, which the page maps
// to a 500 (or surfaces via the existing catch). Validation errors are
// thrown here so the UI can show them inline without a DB roundtrip.

import type { Profile } from '@db/schema';
import type { ProfileRepository } from '../domain/profile.repository';

/** Hard limits — keep here so the page can mirror them in `maxlength`. */
export const ProfileRules = {
  MaxDisplayNameLength: 100,
} as const;

const VALID_ROUTINE_TYPES = ['hombre', 'mujer'] as const;
const VALID_WEIGHT_UNITS = ['kg', 'lbs'] as const;

type RoutineType = (typeof VALID_ROUTINE_TYPES)[number];
type WeightUnit = (typeof VALID_WEIGHT_UNITS)[number];

export class DisplayNameRequiredError extends Error {
  constructor() {
    super(`displayName is required and cannot be empty.`);
    this.name = 'DisplayNameRequiredError';
  }
}

export class DisplayNameTooLongError extends Error {
  constructor(public readonly actualLength: number) {
    super(
      `displayName exceeds ${ProfileRules.MaxDisplayNameLength} characters (got ${actualLength}).`,
    );
    this.name = 'DisplayNameTooLongError';
  }
}

export class InvalidRoutineTypeError extends Error {
  constructor(public readonly actual: unknown) {
    super(
      `routineType must be 'hombre' or 'mujer' (got ${JSON.stringify(actual)}).`,
    );
    this.name = 'InvalidRoutineTypeError';
  }
}

export class InvalidWeightUnitError extends Error {
  constructor(public readonly actual: unknown) {
    super(
      `weightUnit must be 'kg' or 'lbs' (got ${JSON.stringify(actual)}).`,
    );
    this.name = 'InvalidWeightUnitError';
  }
}

export interface UpdateProfileInput {
  userId: string;
  displayName?: string;
  routineType?: RoutineType;
  weightUnit?: WeightUnit;
}

export class UpdateProfileUseCase {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async execute(input: UpdateProfileInput): Promise<Profile> {
    const { userId } = input;

    if (input.displayName !== undefined) {
      this.validateDisplayName(input.displayName);
    }
    if (input.routineType !== undefined) {
      this.validateRoutineType(input.routineType);
    }
    if (input.weightUnit !== undefined) {
      this.validateWeightUnit(input.weightUnit);
    }

    const patch: Partial<Pick<Profile, 'displayName' | 'routineType' | 'weightUnit'>> = {};
    if (input.displayName !== undefined) {
      patch.displayName = input.displayName.trim();
    }
    if (input.routineType !== undefined) {
      patch.routineType = input.routineType;
    }
    if (input.weightUnit !== undefined) {
      patch.weightUnit = input.weightUnit;
    }

    return this.profileRepository.update(userId, patch);
  }

  private validateDisplayName(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new DisplayNameRequiredError();
    }
    if (trimmed.length > ProfileRules.MaxDisplayNameLength) {
      throw new DisplayNameTooLongError(trimmed.length);
    }
  }

  private validateRoutineType(value: unknown): void {
    if (typeof value !== 'string' || !VALID_ROUTINE_TYPES.includes(value as RoutineType)) {
      throw new InvalidRoutineTypeError(value);
    }
  }

  private validateWeightUnit(value: unknown): void {
    if (typeof value !== 'string' || !VALID_WEIGHT_UNITS.includes(value as WeightUnit)) {
      throw new InvalidWeightUnitError(value);
    }
  }
}
