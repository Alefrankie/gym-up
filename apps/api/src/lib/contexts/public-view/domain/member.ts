// src/lib/contexts/public-view/domain/member.ts
//
// Domain types for the Public View (Family) context.
//
// Per docs/architecture/contexts/public-view/readme.md:
// - MemberCard: derived entity with profile + computed stats
// - MemberStats: total workouts, current streak, last workout date
// - MemberProfile: full detail for /family/[user_id] page
//
// Per ADR-004: all users can read all profiles.
// Per ADR-005: photos are NEVER exposed (omitted from types entirely).
// Per FR-PV-003: email is PRIVATE — omitted from all public-view types.
// Per golden-rules (Null Policy): absent values use `T | null`, never `undefined`.

/**
 * Routine type — mirrors the profile's routine_type enum.
 * Kept as a local alias so public-view doesn't import workout-tracking types.
 */
export type PublicRoutineType = 'hombre' | 'mujer';

/**
 * Summary card for one family member on the /family page.
 * Email is deliberately omitted (FR-PV-003 — private).
 */
export interface MemberCard {
  id: string;
  displayName: string;
  routineType: PublicRoutineType;
  totalWorkouts: number;
  currentStreak: number;
  lastWorkout: string | null;
}

/**
 * Computed stats for a single member.
 * Used by CalculateMemberStatsUseCase.
 */
export interface MemberStats {
  totalWorkouts: number;
  currentStreak: number;
  lastWorkout: string | null;
}

/**
 * Full profile detail for the /family/[user_id] page.
 * Includes workout history for calendar/streak rendering.
 * Photos are NEVER included (ADR-005).
 */
export interface MemberProfile {
  profile: MemberCard;
  workouts: Array<{ id: string; workoutDate: string }>;
  stats: MemberStats;
}

// ---------- Use case inputs ----------

export interface GetAllMembersInput {
  // No params — returns all profiles.
}

export interface GetMemberDetailInput {
  memberId: string;
}

export interface CalculateMemberStatsInput {
  userId: string;
}
