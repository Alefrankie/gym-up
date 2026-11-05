// src/lib/contexts/community/domain/community.repository.ts
//
// Community (DR-0028): read models over completed workouts, plus likes and shared photos. Every projection here
// lists its fields explicitly; private columns (body weight, set notes, intake logs, progress photos) are never
// selected, so they cannot leak through a later DTO change.

export interface WorkoutCursor {
  workoutDateMs: number;
  id: string;
}

export interface CommunityExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  topWeightKg: number;
}

export interface CommunityWorkout {
  id: string;
  authorId: string;
  authorName: string;
  workoutDate: Date;
  dayName: string;
  routineName: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  exercises: CommunityExercise[];
  totalSets: number;
  volumeKg: number;
  hasPhoto: boolean;
  likeCount: number;
  viewerHasLiked: boolean;
}

export interface CommunityMember {
  id: string;
  displayName: string;
  totalWorkouts: number;
  lastWorkout: Date | null;
}

export interface RoutineSummary {
  name: string;
  days: Array<{
    dayName: string;
    focus: string;
    exercises: Array<{ name: string; sets: number; repsMin: number; repsMax: number }>;
  }>;
}

export interface PeriodTotals {
  sessions: number;
  sets: number;
  volumeKg: number;
}

export interface SharedPhotoRecord {
  workoutId: string;
  ownerId: string;
  storageKey: string;
  contentType: string;
}

export abstract class CommunityRepository {
  /** Completed workouts newest first (workout date, then id), hydrated for the viewer. */
  abstract listWorkouts(opts: {
    viewerId: string;
    authorId?: string;
    excludeAuthorId?: string;
    cursor: WorkoutCursor | null;
    limit: number;
  }): Promise<CommunityWorkout[]>;

  /** A completed workout, or undefined when it does not exist or is still in progress. */
  abstract findWorkout(viewerId: string, workoutId: string): Promise<CommunityWorkout | undefined>;

  abstract listMembers(): Promise<CommunityMember[]>;
  abstract findMember(memberId: string): Promise<CommunityMember | undefined>;
  abstract activeRoutine(memberId: string): Promise<RoutineSummary | null>;
  abstract activeSupplementNames(memberId: string): Promise<string[]>;
  /** Completed workouts whose calendar day falls in [from, to) (ms). */
  abstract totals(memberId: string, fromMs: number, toMs: number): Promise<PeriodTotals>;

  /** Idempotent. */
  abstract like(workoutId: string, userId: string, at: number): Promise<void>;
  /** Idempotent. */
  abstract unlike(workoutId: string, userId: string): Promise<void>;
  abstract likeState(workoutId: string, viewerId: string): Promise<{ likeCount: number; viewerHasLiked: boolean }>;

  abstract findPhoto(workoutId: string): Promise<SharedPhotoRecord | undefined>;
  abstract savePhoto(record: SharedPhotoRecord & { bytes: number; createdAt: number }): Promise<void>;
  abstract deletePhoto(workoutId: string): Promise<void>;
}
