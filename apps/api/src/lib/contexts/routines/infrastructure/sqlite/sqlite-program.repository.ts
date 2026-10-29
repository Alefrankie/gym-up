import { and, asc, desc, eq, inArray, lt, notInArray, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  exercises,
  profiles,
  routineDays,
  routineExercises,
  routines,
  workoutEntries,
  workouts,
  type Routine,
} from '@db/schema';
import {
  InvalidProgramError,
  ProgramRepository,
  type LastPerformance,
  type NewProgram,
  type NewProgramRoutine,
  type ProgramTree,
} from '../../domain/program.repository';

export class SqliteProgramRepository implements ProgramRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Routine | undefined> {
    const rows = await this.db.select().from(routines).where(eq(routines.id, id)).limit(1);
    return rows[0];
  }

  listTemplates(): Promise<Routine[]> {
    return this.db
      .select()
      .from(routines)
      .where(and(eq(routines.isTemplate, true), eq(routines.isArchived, false)))
      .orderBy(asc(routines.daysPerWeek), asc(routines.name));
  }

  listByOwner(ownerId: string): Promise<Routine[]> {
    return this.db
      .select()
      .from(routines)
      .where(and(eq(routines.ownerId, ownerId), eq(routines.isArchived, false)))
      .orderBy(desc(routines.updatedAt));
  }

  async countByOwner(ownerId: string): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(routines)
      .where(and(eq(routines.ownerId, ownerId), eq(routines.isArchived, false)));
    return Number(rows[0]?.n ?? 0);
  }

  async routineCounts(programIds: string[]): Promise<Map<string, number>> {
    if (programIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: routineDays.routineId, n: sql<number>`count(*)` })
      .from(routineDays)
      .where(inArray(routineDays.routineId, programIds))
      .groupBy(routineDays.routineId);
    return new Map(rows.map((r) => [r.id, Number(r.n)]));
  }

  async findTree(programId: string): Promise<ProgramTree | undefined> {
    const program = await this.findById(programId);
    if (!program) return undefined;
    const days = await this.db
      .select()
      .from(routineDays)
      .where(eq(routineDays.routineId, programId))
      .orderBy(asc(routineDays.dayNumber));
    const slots = days.length
      ? await this.db
          .select({ slot: routineExercises, exercise: exercises })
          .from(routineExercises)
          .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
          .where(inArray(routineExercises.routineDayId, days.map((d) => d.id)))
          .orderBy(asc(routineExercises.exerciseOrder))
      : [];
    return {
      program,
      routines: days.map((day) => ({
        day,
        slots: slots.filter((s) => s.slot.routineDayId === day.id).map((s) => ({ ...s.slot, exercise: s.exercise })),
      })),
    };
  }

  async findTemplateByType(type: 'hombre' | 'mujer'): Promise<Routine | undefined> {
    const rows = await this.db
      .select()
      .from(routines)
      .where(and(eq(routines.isTemplate, true), eq(routines.type, type)))
      .limit(1);
    return rows[0];
  }

  async exerciseIdsThatExist(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(inArray(exercises.id, [...new Set(ids)]), eq(exercises.isArchived, false)));
    return new Set(rows.map((r) => r.id));
  }

  async createProgram(input: NewProgram): Promise<Routine> {
    const now = Date.now();
    const rows = await this.db
      .insert(routines)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        name: input.name,
        type: input.type,
        description: input.description,
        sourceTemplateId: input.sourceTemplateId,
        level: input.level,
        goal: input.goal,
        isTemplate: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return rows[0]!;
  }

  async updateProgram(
    id: string,
    patch: { name: string; description: string | null; daysPerWeek: number },
  ): Promise<void> {
    await this.db
      .update(routines)
      .set({ name: patch.name, description: patch.description, daysPerWeek: patch.daysPerWeek, updatedAt: Date.now() })
      .where(eq(routines.id, id));
  }

  /**
   * D1 has no interactive transactions, so this is a sequence of idempotent statements:
   * a retry of the same PUT converges to the same state (ADR-025, ADR-027 spike).
   */
  async replaceRoutines(programId: string, input: NewProgramRoutine[]): Promise<void> {
    const keepIds = input.map((r) => r.id);
    try {
      if (keepIds.length === 0) {
        await this.db.delete(routineDays).where(eq(routineDays.routineId, programId));
      } else {
        await this.db
          .delete(routineDays)
          .where(and(eq(routineDays.routineId, programId), notInArray(routineDays.id, keepIds)));
      }
    } catch (err) {
      if (err instanceof Error && /FOREIGN KEY/i.test(err.message)) {
        throw new InvalidProgramError('A routine that already has workouts cannot be removed');
      }
      throw err;
    }

    for (const [i, r] of input.entries()) {
      await this.db
        .insert(routineDays)
        .values({ id: r.id, routineId: programId, dayNumber: i + 1, dayName: r.name, focus: r.focus, notes: r.notes })
        .onConflictDoUpdate({
          target: routineDays.id,
          set: { dayNumber: i + 1, dayName: r.name, focus: r.focus, notes: r.notes },
          setWhere: eq(routineDays.routineId, programId),
        });
      const slotIds = r.slots.map((s) => s.id);
      if (slotIds.length === 0) {
        await this.db.delete(routineExercises).where(eq(routineExercises.routineDayId, r.id));
        continue;
      }
      await this.db
        .delete(routineExercises)
        .where(and(eq(routineExercises.routineDayId, r.id), notInArray(routineExercises.id, slotIds)));
      for (const [j, s] of r.slots.entries()) {
        const values = {
          routineDayId: r.id,
          exerciseId: s.exerciseId,
          targetSets: s.targetSets,
          targetReps: s.targetReps,
          targetRepsMin: s.targetReps,
          targetRepsMax: s.targetReps,
          warmupSets: s.warmupSets,
          restSeconds: s.restSeconds,
          notes: s.notes,
          exerciseOrder: j + 1,
        };
        await this.db
          .insert(routineExercises)
          .values({ id: s.id, ...values })
          .onConflictDoUpdate({ target: routineExercises.id, set: values, setWhere: eq(routineExercises.routineDayId, r.id) });
      }
    }
  }

  async archive(id: string): Promise<void> {
    await this.db.update(routines).set({ isArchived: true, updatedAt: Date.now() }).where(eq(routines.id, id));
  }

  async findProgramIdOfRoutine(routineDayId: string): Promise<string | undefined> {
    const rows = await this.db.select({ id: routineDays.routineId }).from(routineDays).where(eq(routineDays.id, routineDayId)).limit(1);
    return rows[0]?.id;
  }

  async getActiveProgramId(userId: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: profiles.activeProgramId })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  async setActiveProgram(userId: string, programId: string | null): Promise<void> {
    await this.db.update(profiles).set({ activeProgramId: programId }).where(eq(profiles.id, userId));
  }

  async lastPerformance(userId: string, exerciseIds: string[], before: Date): Promise<Map<string, LastPerformance>> {
    const result = new Map<string, LastPerformance>();
    if (exerciseIds.length === 0) return result;
    const rows = await this.db
      .select({
        exerciseId: workoutEntries.exerciseId,
        weight: workoutEntries.weight,
        reps: workoutEntries.reps,
        workoutId: workouts.id,
        date: workouts.workoutDate,
      })
      .from(workoutEntries)
      .innerJoin(workouts, eq(workoutEntries.workoutId, workouts.id))
      .where(
        and(
          eq(workouts.userId, userId),
          eq(workoutEntries.completed, true),
          inArray(workoutEntries.exerciseId, exerciseIds),
          lt(workouts.workoutDate, before),
        ),
      )
      .orderBy(desc(workouts.workoutDate));
    // Rows are newest first: the first workout seen for an exercise is its last session.
    const sessionOf = new Map<string, string>();
    for (const r of rows) {
      const seen = sessionOf.get(r.exerciseId);
      if (seen && seen !== r.workoutId) continue;
      sessionOf.set(r.exerciseId, r.workoutId);
      const best = result.get(r.exerciseId);
      if (!best || r.weight > best.weight || (r.weight === best.weight && r.reps > best.reps)) {
        result.set(r.exerciseId, { weight: r.weight, reps: r.reps, date: r.date.toISOString() });
      }
    }
    return result;
  }

  async lastWorkoutDayNumber(userId: string, programId: string): Promise<number | null> {
    const rows = await this.db
      .select({ dayNumber: routineDays.dayNumber })
      .from(workouts)
      .innerJoin(routineDays, eq(workouts.routineDayId, routineDays.id))
      .where(and(eq(workouts.userId, userId), eq(routineDays.routineId, programId), eq(workouts.status, 'completed')))
      .orderBy(desc(workouts.workoutDate))
      .limit(1);
    return rows[0]?.dayNumber ?? null;
  }
}
