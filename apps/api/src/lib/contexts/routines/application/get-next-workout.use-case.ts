import type { Exercise, RoutineDay, RoutineExercise } from '@db/schema';
import type { WorkoutRepository } from '@/lib/contexts/workout-tracking/domain/workout.repository';
import type { LastPerformance, ProgramRepository } from '../domain/program.repository';
import type { AdoptProgramUseCase } from './program.use-cases';

export type NextWorkoutResult =
  | { kind: 'no_routine' }
  | {
      kind: 'workout_day';
      programName: string;
      routineDay: RoutineDay;
      exercises: ReadonlyArray<RoutineExercise & { exercise: Exercise }>;
      workoutStatus: 'not_started' | 'in_progress' | 'completed';
      existingWorkoutId: string | null;
      dayNumber: number;
      /** Last session's best set per exercise id. */
      last: Record<string, LastPerformance>;
    };

/**
 * The next workout is the next routine in the active program's rotation (ADR-019): the day after the last
 * completed one, wrapping around. A workout already started or finished today pins today's card to that routine.
 * A user with no active program gets the template matching their profile type, adopted lazily.
 */
export class GetNextWorkoutUseCase {
  constructor(
    private readonly programs: ProgramRepository,
    private readonly workouts: WorkoutRepository,
    private readonly adopt: AdoptProgramUseCase,
  ) {}

  async execute(input: { userId: string; routineType: 'hombre' | 'mujer' | null; now?: Date }): Promise<NextWorkoutResult> {
    let programId = await this.programs.getActiveProgramId(input.userId);
    if (programId) {
      const current = await this.programs.findById(programId);
      if (!current || current.isArchived) programId = null;
    }
    if (!programId) {
      if (!input.routineType) return { kind: 'no_routine' };
      const template = await this.programs.findTemplateByType(input.routineType);
      if (!template) return { kind: 'no_routine' };
      programId = (await this.adopt.execute(input.userId, template.id)).program.id;
    }

    const tree = await this.programs.findTree(programId);
    if (!tree || tree.routines.length === 0) return { kind: 'no_routine' };

    const today = await this.workouts.findByUserAndDate(input.userId, input.now ?? new Date());
    const todays = today ? tree.routines.find((r) => r.day.id === today.routineDayId) : undefined;

    let chosen = todays;
    if (!chosen) {
      const last = await this.programs.lastWorkoutDayNumber(input.userId, programId);
      const index = last === null ? 0 : tree.routines.findIndex((r) => r.day.dayNumber > last);
      chosen = tree.routines[index === -1 ? 0 : index]!;
    }

    const startOfToday = new Date(input.now ?? new Date());
    startOfToday.setHours(0, 0, 0, 0);
    const last = await this.programs.lastPerformance(input.userId, chosen.slots.map((s) => s.exerciseId), startOfToday);

    return {
      kind: 'workout_day',
      programName: tree.program.name,
      routineDay: chosen.day,
      exercises: chosen.slots,
      workoutStatus: todays && today ? (today.status === 'completed' ? 'completed' : 'in_progress') : 'not_started',
      existingWorkoutId: todays && today ? today.id : null,
      dayNumber: chosen.day.dayNumber,
      last: Object.fromEntries(last),
    };
  }
}
