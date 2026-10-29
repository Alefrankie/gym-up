import { and, asc, eq, isNotNull, like, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { exercises, type Exercise } from '@db/schema';
import {
  ExerciseLibraryRepository,
  ExerciseNotFoundError,
  type ExerciseFilter,
  type ExercisePatch,
  type NewCustomExercise,
} from '../../domain/exercise-library.repository';

export class SqliteExerciseLibraryRepository implements ExerciseLibraryRepository {
  constructor(private readonly db: Db) {}

  async list(filter: ExerciseFilter): Promise<Exercise[]> {
    const conditions: (SQL | undefined)[] = [];
    if (filter.mine) {
      conditions.push(eq(exercises.ownerId, filter.userId), isNotNull(exercises.ownerId));
    } else {
      conditions.push(eq(exercises.isArchived, false));
    }
    if (filter.q) {
      const term = `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(sql`${exercises.name} LIKE ${term} ESCAPE '\\'`);
    }
    if (filter.muscle) {
      conditions.push(
        or(eq(exercises.muscleGroup, filter.muscle), like(exercises.secondaryMuscles, `%"${filter.muscle}"%`)),
      );
    }
    if (filter.equipment) conditions.push(eq(exercises.equipment, filter.equipment));
    return this.db
      .select()
      .from(exercises)
      .where(and(...conditions))
      .orderBy(asc(exercises.name));
  }

  async findById(id: string): Promise<Exercise | undefined> {
    const rows = await this.db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
    return rows[0];
  }

  async findByName(name: string): Promise<Exercise | undefined> {
    const rows = await this.db
      .select()
      .from(exercises)
      .where(sql`lower(${exercises.name}) = lower(${name})`)
      .limit(1);
    return rows[0];
  }

  async create(input: NewCustomExercise): Promise<Exercise> {
    const rows = await this.db
      .insert(exercises)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        name: input.name,
        muscleGroup: input.muscleGroup,
        secondaryMuscles: JSON.stringify(input.secondaryMuscles),
        equipment: input.equipment,
        exerciseType: input.exerciseType,
        instructions: input.instructions,
        videoUrl: input.videoUrl,
        createdAt: Date.now(),
      })
      .returning();
    return rows[0]!;
  }

  async update(id: string, patch: ExercisePatch): Promise<Exercise> {
    const set: Partial<typeof exercises.$inferInsert> = {};
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.muscleGroup !== undefined) set.muscleGroup = patch.muscleGroup;
    if (patch.secondaryMuscles !== undefined) set.secondaryMuscles = JSON.stringify(patch.secondaryMuscles);
    if (patch.equipment !== undefined) set.equipment = patch.equipment;
    if (patch.exerciseType !== undefined) set.exerciseType = patch.exerciseType;
    if (patch.instructions !== undefined) set.instructions = patch.instructions;
    if (patch.videoUrl !== undefined) set.videoUrl = patch.videoUrl;
    if (patch.isArchived !== undefined) set.isArchived = patch.isArchived;
    const rows = await this.db.update(exercises).set(set).where(eq(exercises.id, id)).returning();
    if (!rows[0]) throw new ExerciseNotFoundError(id);
    return rows[0];
  }
}
