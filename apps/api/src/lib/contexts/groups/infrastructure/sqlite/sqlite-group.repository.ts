import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { groupMembers, groups, type Group } from '@db/schema';
import { GroupRepository } from '../../domain/group.repository';

export class SqliteGroupRepository implements GroupRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Group | undefined> {
    const rows = await this.db.select().from(groups).where(eq(groups.id, id)).limit(1);
    return rows[0];
  }

  async findByCode(code: string): Promise<Group | undefined> {
    const rows = await this.db.select().from(groups).where(eq(groups.code, code)).limit(1);
    return rows[0];
  }

  async listForUser(userId: string): Promise<Array<{ group: Group; memberCount: number }>> {
    const mine = await this.db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    if (mine.length === 0) return [];
    const ids = mine.map((m) => m.groupId);
    const rows = await this.db.select().from(groups).where(inArray(groups.id, ids));
    const counts = await this.db
      .select({ groupId: groupMembers.groupId, n: sql<number>`count(*)` })
      .from(groupMembers)
      .where(inArray(groupMembers.groupId, ids))
      .groupBy(groupMembers.groupId);
    const byId = new Map(counts.map((c) => [c.groupId, Number(c.n)]));
    return rows
      .map((group) => ({ group, memberCount: byId.get(group.id) ?? 0 }))
      .sort((a, b) => a.group.name.localeCompare(b.group.name));
  }

  async memberIds(groupId: string): Promise<string[]> {
    const rows = await this.db.select({ id: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
    return rows.map((r) => r.id);
  }

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);
    return rows.length > 0;
  }

  async countGroupsOf(userId: string): Promise<number> {
    const rows = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    return Number(rows[0]?.n ?? 0);
  }

  async create(input: { id: string; name: string; code: string; ownerId: string }): Promise<Group> {
    const rows = await this.db.insert(groups).values({ ...input, createdAt: Date.now() }).returning();
    return rows[0]!;
  }

  async addMember(groupId: string, userId: string): Promise<void> {
    await this.db.insert(groupMembers).values({ groupId, userId, joinedAt: Date.now() }).onConflictDoNothing();
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  }

  async shareGroup(a: string, b: string): Promise<boolean> {
    const mine = await this.db.select({ g: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, a));
    if (mine.length === 0) return false;
    const rows = await this.db
      .select({ g: groupMembers.groupId })
      .from(groupMembers)
      .where(and(eq(groupMembers.userId, b), inArray(groupMembers.groupId, mine.map((m) => m.g))))
      .limit(1);
    return rows.length > 0;
  }
}
