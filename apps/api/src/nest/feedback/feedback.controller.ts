import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { createFeedbackRequestSchema, updateFeedbackStatusRequestSchema, type CreateFeedbackRequest, type FeedbackItemDto } from '@gym-up/contracts';
import { desc, eq } from 'drizzle-orm';
import { feedbackItems } from '@db/schema';
import type { Db } from '@/lib/db/client';
import type { User } from '@/lib/contexts/auth/auth.types';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { DB } from '../tokens';
import { isAdmin } from '../common/admin';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

const isFeedbackAdmin = (user: User) => isAdmin(user);

type FeedbackRow = typeof feedbackItems.$inferSelect;
const canDelete = (row: FeedbackRow, user: User) => row.authorId === user.id || isFeedbackAdmin(user);
const toDto = (row: FeedbackRow, user: User): FeedbackItemDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  category: row.category,
  status: row.status,
  authorName: row.authorName,
  canDelete: canDelete(row, user),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Controller('feedback')
@UseGuards(AuthGuard)
export class FeedbackController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async list(@CurrentUser() user: User): Promise<{ items: FeedbackItemDto[]; canManage: boolean }> {
    const rows = await this.db.select().from(feedbackItems).orderBy(desc(feedbackItems.createdAt));
    return { canManage: isFeedbackAdmin(user), items: rows.map((row) => toDto(row, user)) };
  }

  @Post()
  async create(@CurrentUser() user: User, @Body(new ZodValidationPipe(createFeedbackRequestSchema)) body: CreateFeedbackRequest): Promise<FeedbackItemDto> {
    const now = Date.now();
    const [row] = await this.db.insert(feedbackItems).values({ id: crypto.randomUUID(), ...body, authorId: user.id, authorName: user.displayName, createdAt: now, updatedAt: now }).returning();
    return toDto(row!, user);
  }

  /** The author can remove their own item (e.g. sent by mistake); the admin can remove any. */
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    const [existing] = await this.db.select().from(feedbackItems).where(eq(feedbackItems.id, id)).limit(1);
    if (!existing) throw new NotFoundException('Feedback not found');
    if (!canDelete(existing, user)) throw new ForbiddenException('Only the author or an admin can delete feedback');
    await this.db.delete(feedbackItems).where(eq(feedbackItems.id, id));
  }

  @Patch(':id/status')
  async setStatus(@CurrentUser() user: User, @Param('id') id: string, @Body(new ZodValidationPipe(updateFeedbackStatusRequestSchema)) body: { status: 'open' | 'planned' | 'in_progress' | 'resolved' }): Promise<FeedbackItemDto> {
    if (!isFeedbackAdmin(user)) throw new ForbiddenException('Only admins can change feedback status');
    const existing = await this.db.select().from(feedbackItems).where(eq(feedbackItems.id, id)).limit(1);
    if (!existing[0]) throw new NotFoundException('Feedback not found');
    const [row] = await this.db.update(feedbackItems).set({ status: body.status, updatedAt: Date.now() }).where(eq(feedbackItems.id, id)).returning();
    return toDto(row!, user);
  }
}
