import type { Exercise, Routine, RoutineDay, RoutineExercise } from '@db/schema';

export type ProgramSlot = RoutineExercise & { exercise: Exercise };
export interface ProgramRoutine {
  day: RoutineDay;
  slots: ProgramSlot[];
}
export interface ProgramTree {
  program: Routine;
  routines: ProgramRoutine[];
}

export interface NewProgramSlot {
  id: string;
  exerciseId: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  warmupSets: number;
  restSeconds: number | null;
  notes: string | null;
}

export interface NewProgramRoutine {
  id: string;
  name: string;
  focus: string;
  notes: string | null;
  slots: NewProgramSlot[];
}

export interface NewProgram {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  sourceTemplateId: string | null;
  level: string | null;
  goal: string | null;
  /** `routines.type` stays NOT NULL; programs without a gendered preset use 'neutral'. */
  type: 'hombre' | 'mujer' | 'neutral';
}

export class ProgramNotFoundError extends Error {
  constructor(id: string) {
    super(`Program not found: ${id}`);
    this.name = 'ProgramNotFoundError';
  }
}

export class ProgramOwnershipError extends Error {
  constructor() {
    super('Only the owner can change this program');
    this.name = 'ProgramOwnershipError';
  }
}

export class ProgramLimitError extends Error {
  constructor(limit: number) {
    super(`You can have at most ${limit} programs`);
    this.name = 'ProgramLimitError';
  }
}

export class InvalidProgramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProgramError';
  }
}

export abstract class ProgramRepository {
  abstract findById(id: string): Promise<Routine | undefined>;
  abstract listTemplates(): Promise<Routine[]>;
  abstract listByOwner(ownerId: string): Promise<Routine[]>;
  abstract countByOwner(ownerId: string): Promise<number>;
  abstract routineCounts(programIds: string[]): Promise<Map<string, number>>;
  abstract findTree(programId: string): Promise<ProgramTree | undefined>;
  /** Template of the given legacy type (used to give users without a program a starting point). */
  abstract findTemplateByType(type: 'hombre' | 'mujer'): Promise<Routine | undefined>;
  abstract exerciseIdsThatExist(ids: string[]): Promise<Set<string>>;

  abstract createProgram(input: NewProgram): Promise<Routine>;
  /** Replaces the program's routines with the given ones (upsert by id, remove the rest). */
  abstract replaceRoutines(programId: string, routines: NewProgramRoutine[]): Promise<void>;
  abstract updateProgram(id: string, patch: { name: string; description: string | null; daysPerWeek: number }): Promise<void>;
  abstract archive(id: string): Promise<void>;

  abstract getActiveProgramId(userId: string): Promise<string | null>;
  abstract setActiveProgram(userId: string, programId: string | null): Promise<void>;
  /** 1-based rotation position of the user's most recent workout done in `programId`, if any. */
  abstract lastWorkoutDayNumber(userId: string, programId: string): Promise<number | null>;
}
