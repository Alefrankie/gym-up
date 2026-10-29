import type { Routine } from '@db/schema';
import {
  InvalidProgramError,
  ProgramLimitError,
  ProgramNotFoundError,
  ProgramOwnershipError,
  type NewProgramRoutine,
  type ProgramRepository,
  type ProgramTree,
} from '../domain/program.repository';

export const MAX_PROGRAMS_PER_USER = 20;

export interface ProgramSlotInput {
  id?: string;
  exerciseId: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  warmupSets: number;
  restSeconds?: number | null;
  notes?: string | null;
}

export interface ProgramRoutineInput {
  id?: string;
  name: string;
  focus: string;
  notes?: string | null;
  exercises: ProgramSlotInput[];
}

export interface ListedPrograms {
  templates: Array<{ program: Routine; routineCount: number }>;
  mine: Array<{ program: Routine; routineCount: number }>;
  activeProgramId: string | null;
}

/** A user sees seeded templates and their own programs; anything else does not exist for them. */
async function loadVisible(repo: ProgramRepository, userId: string, id: string): Promise<ProgramTree> {
  const tree = await repo.findTree(id);
  if (!tree || tree.program.isArchived) throw new ProgramNotFoundError(id);
  if (!tree.program.isTemplate && tree.program.ownerId !== userId) throw new ProgramNotFoundError(id);
  return tree;
}

async function loadOwned(repo: ProgramRepository, userId: string, id: string): Promise<Routine> {
  const program = await repo.findById(id);
  if (!program || program.isArchived) throw new ProgramNotFoundError(id);
  if (program.isTemplate || program.ownerId === null) throw new ProgramOwnershipError();
  if (program.ownerId !== userId) throw new ProgramNotFoundError(id);
  return program;
}

async function assertRoom(repo: ProgramRepository, userId: string): Promise<void> {
  if ((await repo.countByOwner(userId)) >= MAX_PROGRAMS_PER_USER) throw new ProgramLimitError(MAX_PROGRAMS_PER_USER);
}

export class ListProgramsUseCase {
  constructor(private readonly repo: ProgramRepository) {}
  async execute(userId: string): Promise<ListedPrograms> {
    const [templates, mine, activeProgramId] = await Promise.all([
      this.repo.listTemplates(),
      this.repo.listByOwner(userId),
      this.repo.getActiveProgramId(userId),
    ]);
    const counts = await this.repo.routineCounts([...templates, ...mine].map((p) => p.id));
    const withCount = (p: Routine) => ({ program: p, routineCount: counts.get(p.id) ?? 0 });
    return { templates: templates.map(withCount), mine: mine.map(withCount), activeProgramId };
  }
}

export class GetProgramUseCase {
  constructor(private readonly repo: ProgramRepository) {}
  execute(userId: string, id: string): Promise<ProgramTree> {
    return loadVisible(this.repo, userId, id);
  }
}

/** Deep copy of a template (or of the caller's own program) into a new program owned by the caller. */
export class AdoptProgramUseCase {
  constructor(private readonly repo: ProgramRepository) {}

  async execute(userId: string, sourceId: string, newId: string = crypto.randomUUID(), activate = true): Promise<ProgramTree> {
    // Replaying the same adopt (same new id) returns the copy that already exists.
    const existing = await this.repo.findTree(newId);
    if (existing) {
      if (existing.program.ownerId !== userId) throw new ProgramOwnershipError();
      return existing;
    }
    const source = await loadVisible(this.repo, userId, sourceId);
    await assertRoom(this.repo, userId);
    await this.repo.createProgram({
      id: newId,
      ownerId: userId,
      name: source.program.name,
      description: source.program.description,
      sourceTemplateId: source.program.isTemplate ? source.program.id : source.program.sourceTemplateId,
      level: source.program.level,
      goal: source.program.goal,
      type: 'neutral',
    });
    const copy: NewProgramRoutine[] = source.routines.map((r) => ({
      id: crypto.randomUUID(),
      name: r.day.dayName,
      focus: r.day.focus,
      notes: r.day.notes,
      slots: r.slots.map((s) => ({
        id: crypto.randomUUID(),
        exerciseId: s.exerciseId,
        targetSets: s.targetSets,
        targetRepsMin: s.targetRepsMin ?? s.targetReps,
        targetRepsMax: s.targetRepsMax ?? s.targetReps,
        warmupSets: s.warmupSets,
        restSeconds: s.restSeconds,
        notes: s.notes,
      })),
    }));
    await this.repo.replaceRoutines(newId, copy);
    await this.repo.updateProgram(newId, {
      name: source.program.name,
      description: source.program.description,
      daysPerWeek: copy.length,
    });
    if (activate) await this.repo.setActiveProgram(userId, newId);
    const tree = await this.repo.findTree(newId);
    return tree!;
  }
}

export class CreateProgramUseCase {
  constructor(private readonly repo: ProgramRepository) {}
  async execute(userId: string, id: string, input: { name: string; description?: string | null }): Promise<ProgramTree> {
    const existing = await this.repo.findTree(id);
    if (existing) {
      if (existing.program.ownerId !== userId) throw new ProgramOwnershipError();
      return existing;
    }
    await assertRoom(this.repo, userId);
    await this.repo.createProgram({
      id,
      ownerId: userId,
      name: input.name,
      description: input.description ?? null,
      sourceTemplateId: null,
      level: null,
      goal: null,
      type: 'neutral',
    });
    // The first program a user builds becomes the active one.
    if (!(await this.repo.getActiveProgramId(userId))) await this.repo.setActiveProgram(userId, id);
    return (await this.repo.findTree(id))!;
  }
}

export class SaveProgramUseCase {
  constructor(private readonly repo: ProgramRepository) {}

  async execute(
    userId: string,
    id: string,
    input: { name: string; description?: string | null; routines: ProgramRoutineInput[] },
  ): Promise<ProgramTree> {
    await loadOwned(this.repo, userId, id);

    const exerciseIds = input.routines.flatMap((r) => r.exercises.map((e) => e.exerciseId));
    const known = await this.repo.exerciseIdsThatExist(exerciseIds);
    const missing = exerciseIds.find((e) => !known.has(e));
    if (missing) throw new InvalidProgramError(`Unknown or archived exercise: ${missing}`);

    const routines: NewProgramRoutine[] = input.routines.map((r) => ({
      id: r.id ?? crypto.randomUUID(),
      name: r.name,
      focus: r.focus,
      notes: r.notes ?? null,
      slots: r.exercises.map((e) => ({
        id: e.id ?? crypto.randomUUID(),
        exerciseId: e.exerciseId,
        targetSets: e.targetSets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        warmupSets: e.warmupSets,
        restSeconds: e.restSeconds ?? null,
        notes: e.notes ?? null,
      })),
    }));
    if (new Set(routines.map((r) => r.id)).size !== routines.length) {
      throw new InvalidProgramError('Duplicate routine id');
    }

    await this.repo.replaceRoutines(id, routines);
    await this.repo.updateProgram(id, {
      name: input.name,
      description: input.description ?? null,
      daysPerWeek: routines.length,
    });
    return (await this.repo.findTree(id))!;
  }
}

export class ArchiveProgramUseCase {
  constructor(private readonly repo: ProgramRepository) {}
  async execute(userId: string, id: string): Promise<void> {
    await loadOwned(this.repo, userId, id);
    await this.repo.archive(id);
    if ((await this.repo.getActiveProgramId(userId)) === id) await this.repo.setActiveProgram(userId, null);
  }
}

export class ActivateProgramUseCase {
  constructor(private readonly repo: ProgramRepository) {}
  async execute(userId: string, id: string): Promise<void> {
    const tree = await loadVisible(this.repo, userId, id);
    if (tree.routines.length === 0) throw new InvalidProgramError('A program needs at least one routine to be activated');
    if (tree.program.isTemplate) throw new InvalidProgramError('Adopt a template before activating it');
    await this.repo.setActiveProgram(userId, id);
  }
}
