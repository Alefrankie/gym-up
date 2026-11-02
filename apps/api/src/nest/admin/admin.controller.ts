import { BadRequestException, Controller, ForbiddenException, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { adminUserListQuerySchema, type AdminUserDto, type AdminUserListDto } from '@gym-up/contracts';
import { asc, count, like, or, sql } from 'drizzle-orm';
import { profiles } from '@db/schema';
import type { User } from '@/lib/contexts/auth/auth.types';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { isAdmin } from '../common/admin';
import { DB } from '../tokens';
import type { Db } from '@/lib/db/client';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('users')
  async users(@CurrentUser() user: User, @Query() rawQuery: Record<string, unknown>): Promise<AdminUserListDto> {
    if (!isAdmin(user)) throw new ForbiddenException('Only the admin can list users');

    const parsed = adminUserListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException('Invalid user list query');
    const { q, limit, offset } = parsed.data;
    const filter = q
      ? or(like(sql`lower(${profiles.displayName})`, `%${q.toLowerCase()}%`), like(sql`lower(${profiles.email})`, `%${q.toLowerCase()}%`))
      : undefined;

    const [totalRow] = await this.db.select({ total: count() }).from(profiles).where(filter);
    const rows = await this.db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        email: profiles.email,
        createdAt: profiles.createdAt,
        lastAccessAt: profiles.lastAccessAt,
      })
      .from(profiles)
      .where(filter)
      .orderBy(asc(profiles.displayName), asc(profiles.id))
      .limit(limit)
      .offset(offset);

    const items: AdminUserDto[] = rows.map((row) => ({
      ...row,
      isAdmin: isAdmin({ email: row.email }),
      createdAt: row.createdAt.toISOString(),
      lastAccessAt: row.lastAccessAt?.toISOString() ?? null,
    }));
    return { items, total: totalRow?.total ?? 0 };
  }
}
