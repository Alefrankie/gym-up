import { and, asc, count, eq, gte, inArray, lte } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { supplementLogs, supplements, type Supplement } from '@db/schema';
import { SupplementRepository } from '../../domain/supplement.repository';

export class SqliteSupplementRepository implements SupplementRepository {
  constructor(private readonly db: Db) {}

  listActive(userId: string): Promise<Supplement[]> {
    return this.db
      .select()
      .from(supplements)
      .where(and(eq(supplements.userId, userId), eq(supplements.archived, false)))
      .orderBy(asc(supplements.sortOrder), asc(supplements.createdAt));
  }

  async countActive(userId: string): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(supplements)
      .where(and(eq(supplements.userId, userId), eq(supplements.archived, false)));
    return Number(rows[0]?.n ?? 0);
  }

  async hasAny(userId: string): Promise<boolean> {
    const rows = await this.db.select({ id: supplements.id }).from(supplements).where(eq(supplements.userId, userId)).limit(1);
    return rows.length > 0;
  }

  async create(input: { id: string; userId: string; name: string; sortOrder: number }): Promise<Supplement> {
    // Idempotent by the client id: a retried create returns the row already there.
    await this.db
      .insert(supplements)
      .values({ ...input, createdAt: Date.now() })
      .onConflictDoNothing();
    const rows = await this.db.select().from(supplements).where(eq(supplements.id, input.id)).limit(1);
    return rows[0]!;
  }

  async findOwned(id: string, userId: string): Promise<Supplement | undefined> {
    const rows = await this.db
      .select()
      .from(supplements)
      .where(and(eq(supplements.id, id), eq(supplements.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async archive(id: string): Promise<void> {
    await this.db.update(supplements).set({ archived: true }).where(eq(supplements.id, id));
  }

  async takenDays(supplementIds: string[], from: string, to: string): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>(supplementIds.map((id) => [id, []]));
    if (supplementIds.length === 0) return out;
    const rows = await this.db
      .select({ id: supplementLogs.supplementId, day: supplementLogs.day })
      .from(supplementLogs)
      .where(and(inArray(supplementLogs.supplementId, supplementIds), gte(supplementLogs.day, from), lte(supplementLogs.day, to)))
      .orderBy(asc(supplementLogs.day));
    for (const r of rows) out.get(r.id)?.push(r.day);
    return out;
  }

  async setTaken(supplementId: string, day: string, taken: boolean): Promise<void> {
    if (taken) {
      await this.db.insert(supplementLogs).values({ supplementId, day, takenAt: Date.now() }).onConflictDoNothing();
    } else {
      await this.db.delete(supplementLogs).where(and(eq(supplementLogs.supplementId, supplementId), eq(supplementLogs.day, day)));
    }
  }
}
