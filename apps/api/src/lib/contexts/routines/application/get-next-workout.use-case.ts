import type { Exercise, RoutineDay, RoutineExercise, Workout } from '@db/schema';
import type { WorkoutRepository } from '@/lib/contexts/workout-tracking/domain/workout.repository';
import type { LastPerformance, ProgramRepository, ProgramRoutine, ProgramTree } from '../domain/program.repository';
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

    const todaysWorkouts = await this.workouts.findAllByUserAndDate(input.userId, input.now ?? new Date());
    // Several routines can be done on one day: an unfinished one wins, then the latest finished one.
    const inProgram = todaysWorkouts.filter((w) => tree.routines.some((r) => r.day.id === w.routineDayId));
    const today = inProgram.find((w) => w.status === 'in_progress') ?? inProgram[0];
    const todays = today ? tree.routines.find((r) => r.day.id === today.routineDayId) : undefined;

    let chosen = todays;
    if (!chosen) {
      const last = await this.programs.lastWorkoutDayNumber(input.userId, programId);
      const index = last === null ? 0 : tree.routines.findIndex((r) => r.day.dayNumber > last);
      chosen = tree.routines[index === -1 ? 0 : index]!;
    }

    return this.describe(input.userId, tree, chosen, today, todays, input.now);
  }

  /** Any routine of a program the user can see, to start it on any day (not only the one the rotation says). */
  async forRoutine(input: { userId: string; routineDayId: string; now?: Date }): Promise<NextWorkoutResult> {
    const programId = await this.programs.findProgramIdOfRoutine(input.routineDayId);
    if (!programId) return { kind: 'no_routine' };
    const tree = await this.programs.findTree(programId);
    if (!tree || tree.program.isArchived) return { kind: 'no_routine' };
    if (!tree.program.isTemplate && tree.program.ownerId !== input.userId) return { kind: 'no_routine' };
    const chosen = tree.routines.find((r) => r.day.id === input.routineDayId);
    if (!chosen) return { kind: 'no_routine' };
    const todays = (await this.workouts.findAllByUserAndDate(input.userId, input.now ?? new Date())).find(
      (w) => w.routineDayId === input.routineDayId,
    );
    return this.describe(input.userId, tree, chosen, todays, todays ? chosen : undefined, input.now);
  }

  private async describe(
    userId: string,
    tree: ProgramTree,
    chosen: ProgramRoutine,
    today: Workout | undefined,
    todays: ProgramRoutine | undefined,
    now?: Date,
  ): Promise<NextWorkoutResult> {
    const startOfToday = new Date(now ?? new Date());
    startOfToday.setHours(0, 0, 0, 0);
    const last = await this.programs.lastPerformance(userId, chosen.slots.map((s) => s.exerciseId), startOfToday);

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
