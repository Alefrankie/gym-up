// src/lib/contexts/community/infrastructure/sqlite/sqlite-community.repository.ts
//
// SQLite/D1 implementation of the community read models (DR-0028). A page is one query for the workouts and
// one batched query per relation (sets, likes, photos), never one query per card.

import { and, asc, desc, eq, gte, inArray, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import {
  exercises,
  profiles,
  routineDays,
  routineExercises,
  routines,
  sharedWorkoutPhotos,
  supplements,
  workoutEntries,
  workoutLikes,
  workouts,
} from '@db/schema';
import type {
  CommunityExercise,
  CommunityMember,
  CommunityRepository,
  CommunityWorkout,
  PeriodTotals,
  RoutineSummary,
  SharedPhotoRecord,
  WorkoutCursor,
} from '../../domain/community.repository';

export class SqliteCommunityRepository implements CommunityRepository {
  constructor(private readonly db: Db) {}

  async listWorkouts(opts: {
    viewerId: string;
    authorId?: string;
    excludeAuthorId?: string;
    cursor: WorkoutCursor | null;
    limit: number;
  }): Promise<CommunityWorkout[]> {
    const where: SQL[] = [eq(workouts.status, 'completed')];
    if (opts.authorId) where.push(eq(workouts.userId, opts.authorId));
    if (opts.excludeAuthorId) where.push(ne(workouts.userId, opts.excludeAuthorId));
    if (opts.cursor) {
      const at = new Date(opts.cursor.workoutDateMs);
      where.push(or(lt(workouts.workoutDate, at), and(eq(workouts.workoutDate, at), lt(workouts.id, opts.cursor.id)))!);
    }
    const rows = await this.baseQuery()
      .where(and(...where))
      .orderBy(desc(workouts.workoutDate), desc(workouts.id))
      .limit(opts.limit);
    return this.hydrate(rows, opts.viewerId);
  }

  async findWorkout(viewerId: string, workoutId: string): Promise<CommunityWorkout | undefined> {
    const rows = await this.baseQuery()
      .where(and(eq(workouts.id, workoutId), eq(workouts.status, 'completed')))
      .limit(1);
    return (await this.hydrate(rows, viewerId))[0];
  }

  private baseQuery() {
    return this.db
      .select({
        id: workouts.id,
        authorId: workouts.userId,
        authorName: profiles.displayName,
        workoutDate: workouts.workoutDate,
        startedAt: workouts.startedAt,
        completedAt: workouts.completedAt,
        dayName: routineDays.dayName,
        routineName: routines.name,
      })
      .from(workouts)
      .innerJoin(profiles, eq(profiles.id, workouts.userId))
      .innerJoin(routineDays, eq(routineDays.id, workouts.routineDayId))
      .leftJoin(routines, eq(routines.id, routineDays.routineId));
  }

  private async hydrate(
    rows: Array<{
      id: string;
      authorId: string;
      authorName: string;
      workoutDate: Date;
      startedAt: Date | null;
      completedAt: Date | null;
      dayName: string;
      routineName: string | null;
    }>,
    viewerId: string,
  ): Promise<CommunityWorkout[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [sets, likes, photos] = await Promise.all([
      this.db
        .select({
          workoutId: workoutEntries.workoutId,
          exerciseId: workoutEntries.exerciseId,
          name: exercises.name,
          reps: workoutEntries.reps,
          weight: workoutEntries.weight,
          setNumber: workoutEntries.setNumber,
          createdAt: workoutEntries.createdAt,
        })
        .from(workoutEntries)
        .innerJoin(exercises, eq(exercises.id, workoutEntries.exerciseId))
        .where(and(inArray(workoutEntries.workoutId, ids), eq(workoutEntries.completed, true), ne(workoutEntries.setType, 'warmup')))
        .orderBy(asc(workoutEntries.createdAt), asc(workoutEntries.setNumber)),
      this.db
        .select({
          workoutId: workoutLikes.workoutId,
          count: sql<number>`count(*)`,
          mine: sql<number>`sum(case when ${workoutLikes.userId} = ${viewerId} then 1 else 0 end)`,
        })
        .from(workoutLikes)
        .where(inArray(workoutLikes.workoutId, ids))
        .groupBy(workoutLikes.workoutId),
      this.db
        .select({ workoutId: sharedWorkoutPhotos.workoutId })
        .from(sharedWorkoutPhotos)
        .where(inArray(sharedWorkoutPhotos.workoutId, ids)),
    ]);

    const byWorkout = new Map<string, Map<string, CommunityExercise>>();
    for (const s of sets) {
      let list = byWorkout.get(s.workoutId);
      if (!list) byWorkout.set(s.workoutId, (list = new Map()));
      const ex = list.get(s.exerciseId) ?? { exerciseId: s.exerciseId, name: s.name, sets: 0, reps: 0, topWeightKg: 0 };
      ex.sets += 1;
      ex.reps += s.reps;
      ex.topWeightKg = Math.max(ex.topWeightKg, s.weight);
      list.set(s.exerciseId, ex);
    }
    const volume = new Map<string, number>();
    for (const s of sets) volume.set(s.workoutId, (volume.get(s.workoutId) ?? 0) + s.reps * s.weight);
    const likeMap = new Map(likes.map((l) => [l.workoutId, l]));
    const photoSet = new Set(photos.map((p) => p.workoutId));

    return rows.map((r) => {
      const exList = [...(byWorkout.get(r.id)?.values() ?? [])];
      const like = likeMap.get(r.id);
      return {
        ...r,
        exercises: exList,
        totalSets: exList.reduce((n, e) => n + e.sets, 0),
        volumeKg: volume.get(r.id) ?? 0,
        hasPhoto: photoSet.has(r.id),
        likeCount: Number(like?.count ?? 0),
        viewerHasLiked: Number(like?.mine ?? 0) > 0,
      };
    });
  }

  async listMembers(): Promise<CommunityMember[]> {
    return this.memberQuery().orderBy(asc(profiles.displayName));
  }

  async findMember(memberId: string): Promise<CommunityMember | undefined> {
    const [row] = await this.memberQuery().where(eq(profiles.id, memberId)).limit(1);
    return row;
  }

  private memberQuery() {
    return this.db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        totalWorkouts: sql<number>`count(${workouts.id})`.mapWith(Number),
        lastWorkout: sql<number | null>`max(${workouts.workoutDate})`.mapWith((v: number | null) => (v == null ? null : new Date(Number(v)))),
      })
      .from(profiles)
      .leftJoin(workouts, and(eq(workouts.userId, profiles.id), eq(workouts.status, 'completed')))
      .groupBy(profiles.id)
      .$dynamic();
  }

  async activeRoutine(memberId: string): Promise<RoutineSummary | null> {
    const [routine] = await this.db
      .select({ id: routines.id, name: routines.name })
      .from(profiles)
      .innerJoin(routines, eq(routines.id, profiles.activeProgramId))
      .where(and(eq(profiles.id, memberId), eq(routines.isArchived, false)))
      .limit(1);
    if (!routine) return null;
    const rows = await this.db
      .select({
        dayId: routineDays.id,
        dayName: routineDays.dayName,
        focus: routineDays.focus,
        exercise: exercises.name,
        sets: routineExercises.targetSets,
        reps: routineExercises.targetReps,
        repsMin: routineExercises.targetRepsMin,
        repsMax: routineExercises.targetRepsMax,
      })
      .from(routineDays)
      .leftJoin(routineExercises, eq(routineExercises.routineDayId, routineDays.id))
      .leftJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
      .where(eq(routineDays.routineId, routine.id))
      .orderBy(asc(routineDays.dayNumber), asc(routineExercises.exerciseOrder));
    const days = new Map<string, RoutineSummary['days'][number]>();
    for (const r of rows) {
      let day = days.get(r.dayId);
      if (!day) days.set(r.dayId, (day = { dayName: r.dayName, focus: r.focus, exercises: [] }));
      if (r.exercise && r.sets != null && r.reps != null) {
        day.exercises.push({ name: r.exercise, sets: r.sets, repsMin: r.repsMin ?? r.reps, repsMax: r.repsMax ?? r.reps });
      }
    }
    return { name: routine.name, days: [...days.values()] };
  }

  async activeSupplementNames(memberId: string): Promise<string[]> {
    const rows = await this.db
      .select({ name: supplements.name })
      .from(supplements)
      .where(and(eq(supplements.userId, memberId), eq(supplements.archived, false)))
      .orderBy(asc(supplements.sortOrder), asc(supplements.createdAt));
    return rows.map((r) => r.name);
  }

  async totals(memberId: string, fromMs: number, toMs: number): Promise<PeriodTotals> {
    const inRange = and(
      eq(workouts.userId, memberId),
      eq(workouts.status, 'completed'),
      gte(workouts.workoutDate, new Date(fromMs)),
      lt(workouts.workoutDate, new Date(toMs)),
    );
    const [[sessions], [work]] = await Promise.all([
      this.db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(workouts).where(inRange),
      this.db
        .select({
          sets: sql<number>`count(${workoutEntries.id})`.mapWith(Number),
          volume: sql<number>`coalesce(sum(${workoutEntries.reps} * ${workoutEntries.weight}), 0)`.mapWith(Number),
        })
        .from(workoutEntries)
        .innerJoin(workouts, eq(workouts.id, workoutEntries.workoutId))
        .where(and(inRange, eq(workoutEntries.completed, true), ne(workoutEntries.setType, 'warmup'))),
    ]);
    return { sessions: sessions?.n ?? 0, sets: work?.sets ?? 0, volumeKg: work?.volume ?? 0 };
  }

  async like(workoutId: string, userId: string, at: number): Promise<void> {
    await this.db.insert(workoutLikes).values({ workoutId, userId, createdAt: at }).onConflictDoNothing();
  }

  async unlike(workoutId: string, userId: string): Promise<void> {
    await this.db.delete(workoutLikes).where(and(eq(workoutLikes.workoutId, workoutId), eq(workoutLikes.userId, userId)));
  }

  async likeState(workoutId: string, viewerId: string): Promise<{ likeCount: number; viewerHasLiked: boolean }> {
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        mine: sql<number>`coalesce(sum(case when ${workoutLikes.userId} = ${viewerId} then 1 else 0 end), 0)`.mapWith(Number),
      })
      .from(workoutLikes)
      .where(eq(workoutLikes.workoutId, workoutId));
    return { likeCount: row?.count ?? 0, viewerHasLiked: (row?.mine ?? 0) > 0 };
  }

  async findPhoto(workoutId: string): Promise<SharedPhotoRecord | undefined> {
    const [row] = await this.db
      .select({
        workoutId: sharedWorkoutPhotos.workoutId,
        ownerId: sharedWorkoutPhotos.ownerId,
        storageKey: sharedWorkoutPhotos.storageKey,
        contentType: sharedWorkoutPhotos.contentType,
      })
      .from(sharedWorkoutPhotos)
      .where(eq(sharedWorkoutPhotos.workoutId, workoutId))
      .limit(1);
    return row;
  }

  async savePhoto(record: SharedPhotoRecord & { bytes: number; createdAt: number }): Promise<void> {
    await this.db
      .insert(sharedWorkoutPhotos)
      .values(record)
      .onConflictDoUpdate({
        target: sharedWorkoutPhotos.workoutId,
        set: { storageKey: record.storageKey, contentType: record.contentType, bytes: record.bytes, createdAt: record.createdAt },
      });
  }

  async deletePhoto(workoutId: string): Promise<void> {
    await this.db.delete(sharedWorkoutPhotos).where(eq(sharedWorkoutPhotos.workoutId, workoutId));
  }
}
