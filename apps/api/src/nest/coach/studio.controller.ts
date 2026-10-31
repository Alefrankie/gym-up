import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  COACH_RECORDING_MAX_BYTES,
  COACH_RECORDING_TYPES,
  STUDIO_DAILY_BYTES,
  STUDIO_DAILY_WRITES,
  STUDIO_USER_TOTAL_BYTES,
  coachRecordingIdSchema,
  coachRecordingMetaSchema,
  coachTextProblems,
  studioActiveRequestSchema,
  studioCommentRequestSchema,
  studioCustomLineRequestSchema,
  studioLineTextRequestSchema,
  type StudioCustomLineDto,
  type StudioCustomLineRequest,
  type StudioHistoryEntryDto,
  type StudioLineTextRequest,
  type CoachRecordingMeta,
  type StudioAccess,
  type StudioCommentDto,
  type StudioCommentRequest,
  type StudioOverview,
  type StudioTakeDto,
} from '@gym-up/contracts';
import { and, asc, eq, like, or, sql } from 'drizzle-orm';
import {
  profiles,
  studioActive,
  studioComments,
  studioCustomLines,
  studioLineHistory,
  studioMembers,
  studioOverrides,
  studioTakes,
  studioVotes,
} from '@db/schema';
import type { Db } from '@/lib/db/client';
import type { User } from '@/lib/contexts/auth/auth.types';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { isAdmin } from '../common/admin';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DB } from '../tokens';

interface ResponseLike {
  status(code: number): ResponseLike;
  setHeader(name: string, value: string): void;
  send(body: unknown): void;
}

const lineIdPipe = new ZodValidationPipe(coachRecordingIdSchema);
const takeMetaPipe = new ZodValidationPipe(coachRecordingMetaSchema.extend({ form: coachRecordingMetaSchema.shape.form.optional() }));
const today = () => new Date().toISOString().slice(0, 10);

/** 400 with the reasons when a line breaks the content rules (slurs, bodies, threats, pain, swearing outside gymrat...). */
function checkText(text: string, tone: string) {
  const problems = coachTextProblems(text, tone);
  if (problems.length) {
    throw new BadRequestException(`The line breaks the content rules: ${problems.map((p) => ('word' in p ? `${p.kind}:${p.word}` : p.kind)).join(', ')}`);
  }
}

/** Stable id of an added line's variant (same 32-hex shape as the built-in line ids). */
async function customLineId(groupId: string, form: string | null): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`main|custom|${groupId}|${form ?? '-'}`)));
  return [...hash].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The voice studio. The admin lets people in; everyone inside records one take per line (and may redo it), plays
 * every take, likes takes and comments on lines; the admin picks the active take, the one the app plays for everyone.
 * Authors delete their own takes and comments, the admin deletes anything. Writes are capped per person per day so the
 * whole thing stays inside D1's free tier.
 */
@Controller('studio')
@UseGuards(AuthGuard)
export class StudioController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // ---- access ---------------------------------------------------------------------------------------------------

  async #access(user: User): Promise<StudioAccess> {
    if (isAdmin(user)) return { allowed: true, admin: true };
    const [m] = await this.db.select({ id: studioMembers.userId }).from(studioMembers).where(eq(studioMembers.userId, user.id)).limit(1);
    return { allowed: !!m, admin: false };
  }

  async #member(user: User): Promise<StudioAccess> {
    const a = await this.#access(user);
    if (!a.allowed) throw new ForbiddenException('No access to the voice studio');
    return a;
  }

  #admin(user: User) {
    if (!isAdmin(user)) throw new ForbiddenException('Only the admin can do this');
  }

  /** Reserves one write (and `bytes` uploaded) for today; 429 past the daily caps. */
  async #spend(user: User, bytes = 0) {
    const rows = await this.db.all<{ writes: number }>(sql`
      INSERT INTO studio_usage (user_id, day, writes, bytes) VALUES (${user.id}, ${today()}, 1, ${bytes})
      ON CONFLICT(user_id, day) DO UPDATE SET writes = writes + 1, bytes = bytes + excluded.bytes
      WHERE studio_usage.writes + 1 <= ${STUDIO_DAILY_WRITES} AND studio_usage.bytes + excluded.bytes <= ${STUDIO_DAILY_BYTES}
      RETURNING writes`);
    if (!rows.length || bytes > STUDIO_DAILY_BYTES) throw new HttpException('Daily studio limit reached, try again tomorrow', HttpStatus.TOO_MANY_REQUESTS);
  }

  /** The text a line says now: an edit of a built-in line, else an added line's text; null when neither exists. */
  async #currentText(lineId: string): Promise<string | null> {
    const [o] = await this.db.select({ text: studioOverrides.text }).from(studioOverrides).where(eq(studioOverrides.lineId, lineId)).limit(1);
    if (o) return o.text;
    const [c] = await this.db.select({ text: studioCustomLines.text }).from(studioCustomLines).where(eq(studioCustomLines.lineId, lineId)).limit(1);
    return c?.text ?? null;
  }

  async #history(lineId: string, kind: StudioHistoryEntryDto['kind'], previousText: string | null, newText: string | null, user: User) {
    await this.db.insert(studioLineHistory).values({ id: crypto.randomUUID(), lineId, kind, previousText, newText, authorId: user.id, createdAt: Date.now() });
  }

  @Get('access')
  access(@CurrentUser() user: User): Promise<StudioAccess> {
    return this.#access(user);
  }

  // ---- members (admin) ------------------------------------------------------------------------------------------

  @Get('members')
  async members(@CurrentUser() user: User) {
    this.#admin(user);
    const rows = await this.db
      .select({ userId: studioMembers.userId, displayName: profiles.displayName, email: profiles.email, grantedAt: studioMembers.createdAt })
      .from(studioMembers)
      .innerJoin(profiles, eq(profiles.id, studioMembers.userId))
      .orderBy(asc(profiles.displayName));
    return { items: rows };
  }

  @Get('users')
  async users(@CurrentUser() user: User, @Query('q') q = '') {
    this.#admin(user);
    const term = `%${q.trim().toLowerCase()}%`;
    const rows = await this.db
      .select({ userId: profiles.id, displayName: profiles.displayName, email: profiles.email, member: studioMembers.userId })
      .from(profiles)
      .leftJoin(studioMembers, eq(studioMembers.userId, profiles.id))
      .where(or(like(sql`lower(${profiles.displayName})`, term), like(sql`lower(${profiles.email})`, term)))
      .orderBy(asc(profiles.displayName))
      .limit(20);
    return { items: rows.filter((r) => !isAdmin(r)).map((r) => ({ ...r, member: !!r.member })) };
  }

  @Put('members/:userId')
  @HttpCode(204)
  async grant(@CurrentUser() user: User, @Param('userId') userId: string): Promise<void> {
    this.#admin(user);
    const [p] = await this.db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId)).limit(1);
    if (!p) throw new NotFoundException('User not found');
    await this.db.insert(studioMembers).values({ userId, grantedBy: user.id, createdAt: Date.now() }).onConflictDoNothing();
  }

  @Delete('members/:userId')
  @HttpCode(204)
  async revoke(@CurrentUser() user: User, @Param('userId') userId: string): Promise<void> {
    this.#admin(user);
    await this.db.delete(studioMembers).where(eq(studioMembers.userId, userId));
  }

  // ---- takes ----------------------------------------------------------------------------------------------------

  @Get('overview')
  async overview(@CurrentUser() user: User): Promise<StudioOverview> {
    const a = await this.#member(user);
    const takes = await this.db
      .select({
        id: studioTakes.id,
        lineId: studioTakes.lineId,
        authorId: studioTakes.authorId,
        authorName: profiles.displayName,
        tone: studioTakes.tone,
        locale: studioTakes.locale,
        event: studioTakes.event,
        form: studioTakes.form,
        text: studioTakes.text,
        contentType: studioTakes.contentType,
        bytes: studioTakes.bytes,
        createdAt: studioTakes.createdAt,
        updatedAt: studioTakes.updatedAt,
        votes: sql<number>`(SELECT count(*) FROM studio_votes v WHERE v.take_id = ${studioTakes.id})`,
        votedByMe: sql<number>`(SELECT count(*) FROM studio_votes v WHERE v.take_id = ${studioTakes.id} AND v.user_id = ${user.id})`,
        active: sql<number>`(SELECT count(*) FROM studio_active s WHERE s.take_id = ${studioTakes.id})`,
      })
      .from(studioTakes)
      .innerJoin(profiles, eq(profiles.id, studioTakes.authorId))
      .orderBy(asc(studioTakes.lineId), asc(studioTakes.createdAt));
    const comments = await this.db
      .select({
        id: studioComments.id,
        lineId: studioComments.lineId,
        takeId: studioComments.takeId,
        authorId: studioComments.authorId,
        authorName: profiles.displayName,
        text: studioComments.text,
        createdAt: studioComments.createdAt,
      })
      .from(studioComments)
      .innerJoin(profiles, eq(profiles.id, studioComments.authorId))
      .orderBy(asc(studioComments.createdAt));
    const custom = await this.db
      .select({
        lineId: studioCustomLines.lineId,
        groupId: studioCustomLines.groupId,
        form: studioCustomLines.form,
        tone: studioCustomLines.tone,
        locale: studioCustomLines.locale,
        event: studioCustomLines.event,
        text: studioCustomLines.text,
        status: studioCustomLines.status,
        authorId: studioCustomLines.authorId,
        authorName: profiles.displayName,
        createdAt: studioCustomLines.createdAt,
        updatedAt: studioCustomLines.updatedAt,
      })
      .from(studioCustomLines)
      .innerJoin(profiles, eq(profiles.id, studioCustomLines.authorId))
      .orderBy(asc(studioCustomLines.createdAt));
    const overrides = await this.db
      .select({
        lineId: studioOverrides.lineId,
        originalText: studioOverrides.originalText,
        text: studioOverrides.text,
        updatedAt: studioOverrides.updatedAt,
        updatedByName: profiles.displayName,
      })
      .from(studioOverrides)
      .innerJoin(profiles, eq(profiles.id, studioOverrides.updatedBy));
    return {
      custom: custom.map((c) => ({ ...c, form: (c.form ?? null) as StudioCustomLineDto['form'] }) as StudioCustomLineDto),
      overrides,
      me: { userId: user.id, admin: a.admin },
      takes: takes.map((t) => ({
        ...t,
        tone: t.tone as StudioTakeDto['tone'],
        locale: t.locale as StudioTakeDto['locale'],
        form: (t.form ?? null) as StudioTakeDto['form'],
        votes: Number(t.votes),
        votedByMe: Number(t.votedByMe) > 0,
        active: Number(t.active) > 0,
      })),
      comments,
    };
  }

  /** Records (or redoes) my take of a line: raw audio in the body, the line in the query. */
  @Put('lines/:lineId/take')
  async saveTake(
    @CurrentUser() user: User,
    @Param('lineId', lineIdPipe) lineId: string,
    @Query(takeMetaPipe) meta: Omit<CoachRecordingMeta, 'form'> & { form?: CoachRecordingMeta['form'] },
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
    @Res() res: ResponseLike,
  ): Promise<void> {
    const a = await this.#member(user);
    const type = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    if (!(COACH_RECORDING_TYPES as readonly string[]).includes(type)) throw new BadRequestException(`Unsupported audio type: ${type || 'none'}`);
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(0);
    if (!bytes.length) throw new BadRequestException('The recording is empty');
    if (bytes.length > COACH_RECORDING_MAX_BYTES) throw new BadRequestException('The recording is too long');
    const [{ total }] = await this.db.all<{ total: number }>(
      sql`SELECT coalesce(sum(bytes), 0) AS total FROM studio_takes WHERE author_id = ${user.id} AND line_id <> ${lineId}`,
    );
    if (Number(total) + bytes.length > STUDIO_USER_TOTAL_BYTES) throw new HttpException('Your studio storage is full', HttpStatus.TOO_MANY_REQUESTS);
    await this.#spend(user, bytes.length);

    const now = Date.now();
    const [existing] = await this.db
      .select({ id: studioTakes.id, createdAt: studioTakes.createdAt })
      .from(studioTakes)
      .where(and(eq(studioTakes.lineId, lineId), eq(studioTakes.authorId, user.id)))
      .limit(1);
    const row = {
      id: existing?.id ?? crypto.randomUUID(),
      lineId,
      authorId: user.id,
      tone: meta.tone,
      locale: meta.locale,
      event: meta.event,
      form: meta.form ?? null,
      text: meta.text,
      contentType: (contentType ?? type).trim(),
      audio: Buffer.from(bytes),
      bytes: bytes.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) await this.db.update(studioTakes).set(row).where(eq(studioTakes.id, existing.id));
    else await this.db.insert(studioTakes).values(row);
    // The admin's own take plays by default until the admin picks another one.
    if (a.admin) await this.db.insert(studioActive).values({ lineId, takeId: row.id, chosenBy: user.id, chosenAt: now }).onConflictDoNothing();

    const { audio: _audio, ...rest } = row;
    res.status(200).setHeader('content-type', 'application/json');
    res.send(JSON.stringify({ ...rest, authorName: user.displayName, votes: 0, votedByMe: false, active: false }));
  }

  @Get('takes/:takeId/audio')
  async takeAudio(@CurrentUser() user: User, @Param('takeId') takeId: string, @Res() res: ResponseLike): Promise<void> {
    await this.#member(user);
    const [t] = await this.db.select({ audio: studioTakes.audio, contentType: studioTakes.contentType }).from(studioTakes).where(eq(studioTakes.id, takeId)).limit(1);
    if (!t) throw new NotFoundException('Take not found');
    res.setHeader('content-type', t.contentType);
    res.setHeader('cache-control', 'private, max-age=31536000, immutable');
    res.send(Buffer.from(t.audio));
  }

  /** Authors delete their own take, the admin any take; an active take leaves its line with no active take. */
  @Delete('takes/:takeId')
  @HttpCode(204)
  async deleteTake(@CurrentUser() user: User, @Param('takeId') takeId: string): Promise<void> {
    await this.#member(user);
    const [t] = await this.db.select({ authorId: studioTakes.authorId }).from(studioTakes).where(eq(studioTakes.id, takeId)).limit(1);
    if (!t) throw new NotFoundException('Take not found');
    if (t.authorId !== user.id && !isAdmin(user)) throw new ForbiddenException('You can only delete your own takes');
    await this.#spend(user);
    await this.db.delete(studioActive).where(eq(studioActive.takeId, takeId));
    await this.db.delete(studioVotes).where(eq(studioVotes.takeId, takeId));
    await this.db.update(studioComments).set({ takeId: null }).where(eq(studioComments.takeId, takeId));
    await this.db.delete(studioTakes).where(eq(studioTakes.id, takeId));
  }

  // ---- the active take (admin) ----------------------------------------------------------------------------------

  @Put('lines/:lineId/active')
  @HttpCode(204)
  async choose(
    @CurrentUser() user: User,
    @Param('lineId', lineIdPipe) lineId: string,
    @Body(new ZodValidationPipe(studioActiveRequestSchema)) body: { takeId: string },
  ): Promise<void> {
    this.#admin(user);
    const [t] = await this.db.select({ lineId: studioTakes.lineId }).from(studioTakes).where(eq(studioTakes.id, body.takeId)).limit(1);
    if (!t || t.lineId !== lineId) throw new BadRequestException('That take is not a take of this line');
    const [take] = await this.db.select({ text: studioTakes.text }).from(studioTakes).where(eq(studioTakes.id, body.takeId)).limit(1);
    const current = await this.#currentText(lineId);
    if (current !== null && take!.text !== current) throw new BadRequestException('That take says the previous text: record it again or confirm it first');
    const now = Date.now();
    await this.db
      .insert(studioActive)
      .values({ lineId, takeId: body.takeId, chosenBy: user.id, chosenAt: now })
      .onConflictDoUpdate({ target: studioActive.lineId, set: { takeId: body.takeId, chosenBy: user.id, chosenAt: now } });
  }

  @Delete('lines/:lineId/active')
  @HttpCode(204)
  async clearActive(@CurrentUser() user: User, @Param('lineId', lineIdPipe) lineId: string): Promise<void> {
    this.#admin(user);
    await this.db.delete(studioActive).where(eq(studioActive.lineId, lineId));
  }

  // ---- likes and comments ---------------------------------------------------------------------------------------

  @Put('takes/:takeId/vote')
  @HttpCode(204)
  async vote(@CurrentUser() user: User, @Param('takeId') takeId: string): Promise<void> {
    await this.#member(user);
    const [t] = await this.db.select({ id: studioTakes.id }).from(studioTakes).where(eq(studioTakes.id, takeId)).limit(1);
    if (!t) throw new NotFoundException('Take not found');
    await this.#spend(user);
    await this.db.insert(studioVotes).values({ takeId, userId: user.id, createdAt: Date.now() }).onConflictDoNothing();
  }

  @Delete('takes/:takeId/vote')
  @HttpCode(204)
  async unvote(@CurrentUser() user: User, @Param('takeId') takeId: string): Promise<void> {
    await this.#member(user);
    await this.db.delete(studioVotes).where(and(eq(studioVotes.takeId, takeId), eq(studioVotes.userId, user.id)));
  }

  @Post('lines/:lineId/comments')
  async comment(
    @CurrentUser() user: User,
    @Param('lineId', lineIdPipe) lineId: string,
    @Body(new ZodValidationPipe(studioCommentRequestSchema)) body: StudioCommentRequest,
  ): Promise<StudioCommentDto> {
    await this.#member(user);
    if (body.takeId) {
      const [t] = await this.db.select({ lineId: studioTakes.lineId }).from(studioTakes).where(eq(studioTakes.id, body.takeId)).limit(1);
      if (!t || t.lineId !== lineId) throw new BadRequestException('That take is not a take of this line');
    }
    await this.#spend(user);
    const row = { id: crypto.randomUUID(), lineId, takeId: body.takeId ?? null, authorId: user.id, text: body.text, createdAt: Date.now() };
    await this.db.insert(studioComments).values(row);
    return { ...row, authorName: user.displayName };
  }

  /** Authors delete their own comments, the admin any comment. */
  @Delete('comments/:id')
  @HttpCode(204)
  async deleteComment(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    await this.#member(user);
    const [c] = await this.db.select({ authorId: studioComments.authorId }).from(studioComments).where(eq(studioComments.id, id)).limit(1);
    if (!c) throw new NotFoundException('Comment not found');
    if (c.authorId !== user.id && !isAdmin(user)) throw new ForbiddenException('You can only delete your own comments');
    await this.db.delete(studioComments).where(eq(studioComments.id, id));
  }

  // ---- added lines --------------------------------------------------------------------------------------------

  /** Adds a line. The admin's lines play at once; the ones collaborators add wait for the admin's approval. */
  @Post('custom-lines')
  async addLine(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(studioCustomLineRequestSchema)) body: StudioCustomLineRequest,
  ): Promise<{ items: StudioCustomLineDto[] }> {
    const a = await this.#member(user);
    checkText(body.textM, body.tone);
    if (body.textF) checkText(body.textF, body.tone);
    await this.#spend(user);
    const groupId = crypto.randomUUID();
    const now = Date.now();
    const variants: { form: 'm' | 'f' | null; text: string }[] =
      body.textF && body.textF.trim() !== body.textM.trim()
        ? [{ form: 'm', text: body.textM }, { form: 'f', text: body.textF }]
        : [{ form: null, text: body.textM }];
    const items: StudioCustomLineDto[] = [];
    for (const v of variants) {
      const row = {
        lineId: await customLineId(groupId, v.form),
        groupId,
        form: v.form,
        tone: body.tone,
        locale: body.locale,
        event: body.event,
        text: v.text.trim(),
        status: a.admin ? ('approved' as const) : ('pending' as const),
        authorId: user.id,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.insert(studioCustomLines).values(row);
      await this.#history(row.lineId, 'create', null, row.text, user);
      items.push({ ...row, authorName: user.displayName });
    }
    return { items };
  }

  @Put('custom-lines/:groupId/approve')
  @HttpCode(204)
  async approveLine(@CurrentUser() user: User, @Param('groupId') groupId: string): Promise<void> {
    this.#admin(user);
    const rows = await this.db
      .select({ lineId: studioCustomLines.lineId, text: studioCustomLines.text })
      .from(studioCustomLines)
      .where(eq(studioCustomLines.groupId, groupId));
    if (!rows.length) throw new NotFoundException('Line not found');
    await this.db.update(studioCustomLines).set({ status: 'approved', updatedAt: Date.now() }).where(eq(studioCustomLines.groupId, groupId));
    for (const r of rows) await this.#history(r.lineId, 'approve', null, r.text, user);
  }

  /** The admin deletes any added line; its author may withdraw it while it waits for approval. Its takes go too. */
  @Delete('custom-lines/:groupId')
  @HttpCode(204)
  async deleteLine(@CurrentUser() user: User, @Param('groupId') groupId: string): Promise<void> {
    await this.#member(user);
    const rows = await this.db.select().from(studioCustomLines).where(eq(studioCustomLines.groupId, groupId));
    if (!rows.length) throw new NotFoundException('Line not found');
    const ownPending = rows.every((r) => r.authorId === user.id && r.status === 'pending');
    if (!isAdmin(user) && !ownPending) throw new ForbiddenException('Only the admin deletes approved lines');
    for (const r of rows) {
      const takes = await this.db.select({ id: studioTakes.id }).from(studioTakes).where(eq(studioTakes.lineId, r.lineId));
      for (const t of takes) await this.db.delete(studioVotes).where(eq(studioVotes.takeId, t.id));
      await this.db.delete(studioActive).where(eq(studioActive.lineId, r.lineId));
      await this.db.delete(studioComments).where(eq(studioComments.lineId, r.lineId));
      await this.db.delete(studioTakes).where(eq(studioTakes.lineId, r.lineId));
    }
    await this.db.delete(studioCustomLines).where(eq(studioCustomLines.groupId, groupId));
  }

  // ---- editing a line's text (admin) --------------------------------------------------------------------------

  /**
   * New text for any line: an added line's own text, or an override of a built-in one (which needs its original
   * rendering). Takes recorded for the previous text stay, marked as such, and cannot play until recorded again or
   * confirmed.
   */
  @Put('lines/:lineId/text')
  @HttpCode(204)
  async editText(
    @CurrentUser() user: User,
    @Param('lineId', lineIdPipe) lineId: string,
    @Body(new ZodValidationPipe(studioLineTextRequestSchema)) body: StudioLineTextRequest,
  ): Promise<void> {
    this.#admin(user);
    const text = body.text.trim();
    const now = Date.now();
    const [custom] = await this.db.select().from(studioCustomLines).where(eq(studioCustomLines.lineId, lineId)).limit(1);
    if (custom) {
      checkText(text, custom.tone);
      if (custom.text === text) return;
      await this.db.update(studioCustomLines).set({ text, updatedAt: now }).where(eq(studioCustomLines.lineId, lineId));
      await this.#history(lineId, 'edit', custom.text, text, user);
      return;
    }
    if (!body.originalText || !body.tone || !body.locale || !body.event) {
      throw new BadRequestException('A built-in line needs its original text, tone, language and moment');
    }
    checkText(text, body.tone);
    const [existing] = await this.db.select().from(studioOverrides).where(eq(studioOverrides.lineId, lineId)).limit(1);
    const original = existing?.originalText ?? body.originalText;
    const previous = existing?.text ?? original;
    if (previous === text) return;
    if (text === original) {
      await this.db.delete(studioOverrides).where(eq(studioOverrides.lineId, lineId));
      await this.#history(lineId, 'revert', previous, text, user);
      return;
    }
    const row = {
      lineId,
      originalText: original,
      text,
      tone: body.tone,
      locale: body.locale,
      event: body.event,
      form: body.form ?? null,
      updatedBy: user.id,
      updatedAt: now,
    };
    await this.db
      .insert(studioOverrides)
      .values(row)
      .onConflictDoUpdate({ target: studioOverrides.lineId, set: { text, updatedBy: user.id, updatedAt: now } });
    await this.#history(lineId, 'edit', previous, text, user);
  }

  /** Back to the original text: a built-in line drops its edit; an added line gets the text it was created with. */
  @Delete('lines/:lineId/text')
  @HttpCode(204)
  async revertText(@CurrentUser() user: User, @Param('lineId', lineIdPipe) lineId: string): Promise<void> {
    this.#admin(user);
    const [o] = await this.db.select().from(studioOverrides).where(eq(studioOverrides.lineId, lineId)).limit(1);
    if (o) {
      await this.db.delete(studioOverrides).where(eq(studioOverrides.lineId, lineId));
      await this.#history(lineId, 'revert', o.text, o.originalText, user);
      return;
    }
    const [c] = await this.db.select().from(studioCustomLines).where(eq(studioCustomLines.lineId, lineId)).limit(1);
    if (!c) throw new NotFoundException('Nothing to revert');
    const [created] = await this.db
      .select({ text: studioLineHistory.newText })
      .from(studioLineHistory)
      .where(and(eq(studioLineHistory.lineId, lineId), eq(studioLineHistory.kind, 'create')))
      .limit(1);
    if (!created?.text || created.text === c.text) return;
    await this.db.update(studioCustomLines).set({ text: created.text, updatedAt: Date.now() }).where(eq(studioCustomLines.lineId, lineId));
    await this.#history(lineId, 'revert', c.text, created.text, user);
  }

  @Get('lines/:lineId/history')
  async lineHistory(@CurrentUser() user: User, @Param('lineId', lineIdPipe) lineId: string): Promise<{ items: StudioHistoryEntryDto[] }> {
    await this.#member(user);
    const rows = await this.db
      .select({
        id: studioLineHistory.id,
        lineId: studioLineHistory.lineId,
        kind: studioLineHistory.kind,
        previousText: studioLineHistory.previousText,
        newText: studioLineHistory.newText,
        authorName: profiles.displayName,
        createdAt: studioLineHistory.createdAt,
      })
      .from(studioLineHistory)
      .innerJoin(profiles, eq(profiles.id, studioLineHistory.authorId))
      .where(eq(studioLineHistory.lineId, lineId))
      .orderBy(asc(studioLineHistory.createdAt));
    return { items: rows.map((r) => ({ ...r, kind: r.kind as StudioHistoryEntryDto['kind'] })) };
  }

  /** The admin accepts a take recorded for the previous text as good for the new one. */
  @Post('takes/:takeId/confirm')
  @HttpCode(204)
  async confirmTake(@CurrentUser() user: User, @Param('takeId') takeId: string): Promise<void> {
    this.#admin(user);
    const [t] = await this.db.select({ lineId: studioTakes.lineId }).from(studioTakes).where(eq(studioTakes.id, takeId)).limit(1);
    if (!t) throw new NotFoundException('Take not found');
    const current = await this.#currentText(t.lineId);
    if (current !== null) await this.db.update(studioTakes).set({ text: current }).where(eq(studioTakes.id, takeId));
  }
}
