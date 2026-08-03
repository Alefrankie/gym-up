// src/lib/contexts/workout-tracking/application/get-workout-history.use-case.ts
//
// Use case: fetch paginated workout history for the current user.
//
// Per docs/architecture/contexts/workout-tracking/readme.md Use Cases
// table (GetWorkoutHistoryUseCase — was "planned", now implemented for
// story 3.1). Per AC-3.1-01: chronological list (newest first) of all
// user workouts. Per AC-3.1-02: paginated at 20 per page.
//
// Per Q2 user decision: includes both `in_progress` and `completed`
// workouts — the user may want to resume an in-progress workout from
// the history list.
// Per Q4 user decision: volume = Σ(reps × weight) over completed entries
// (matches `workout-summary.astro`).
//
// Page validation: defaults to 1 when undefined or < 1. Page > totalPages
// returns an empty `items` array (the page component is responsible for
// showing the "out of range" UX, but the use case doesn't throw).

import type {
  WorkoutHistoryItem,
  WorkoutRepository,
} from '../domain/workout.repository';

/** Fixed page size per AC-3.1-02 (20 per page). */
export const HISTORY_PAGE_SIZE = 20;

export interface GetWorkoutHistoryInput {
  userId: string;
  page?: number;
}

export interface GetWorkoutHistoryResult {
  items: WorkoutHistoryItem[];
  currentPage: number;
  totalPages: number;
}

export class GetWorkoutHistoryUseCase {
  constructor(private readonly workoutRepository: WorkoutRepository) {}

  async execute(
    input: GetWorkoutHistoryInput,
  ): Promise<GetWorkoutHistoryResult> {
    // Validate + default page (clamps to >= 1).
    const requestedPage = input.page ?? 1;
    const currentPage = requestedPage < 1 ? 1 : requestedPage;
    const offset = (currentPage - 1) * HISTORY_PAGE_SIZE;

    // Fetch count + items in parallel — independent queries.
    const [totalCount, items] = await Promise.all([
      this.workoutRepository.getHistoryCountByUser(input.userId),
      this.workoutRepository.getHistoryByUser(
        input.userId,
        HISTORY_PAGE_SIZE,
        offset,
      ),
    ]);

    const totalPages =
      totalCount === 0 ? 0 : Math.ceil(totalCount / HISTORY_PAGE_SIZE);

    return {
      items,
      currentPage,
      totalPages,
    };
  }
}
