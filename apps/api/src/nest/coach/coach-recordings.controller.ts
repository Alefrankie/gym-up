import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Put,
  Query,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import {
  COACH_RECORDING_MAX_BYTES,
  COACH_RECORDING_TYPES,
  coachRecordingIdSchema,
  coachRecordingMetaSchema,
  type CoachRecordingDto,
  type CoachRecordingList,
  type CoachRecordingMeta,
} from '@gym-up/contracts';
import { asc, eq } from 'drizzle-orm';
import { coachRecordings } from '@db/schema';
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

type Row = typeof coachRecordings.$inferSelect;
const toDto = (r: Omit<Row, 'audio'>): CoachRecordingDto => ({
  id: r.id,
  tone: r.tone as CoachRecordingDto['tone'],
  locale: r.locale as CoachRecordingDto['locale'],
  event: r.event,
  form: (r.form ?? null) as CoachRecordingDto['form'],
  text: r.text,
  contentType: r.contentType,
  bytes: r.bytes,
  updatedAt: r.updatedAt,
});

/**
 * The Coach's lines recorded in the voice studio. Anyone signed in can list and play them (they are the Coach's
 * voice for everyone); only admins record, replace and delete. Stored in D1, so it costs nothing.
 */
@Controller('coach/recordings')
@UseGuards(AuthGuard)
export class CoachRecordingsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async list(): Promise<CoachRecordingList> {
    const rows = await this.db
      .select({
        id: coachRecordings.id,
        tone: coachRecordings.tone,
        locale: coachRecordings.locale,
        event: coachRecordings.event,
        form: coachRecordings.form,
        text: coachRecordings.text,
        contentType: coachRecordings.contentType,
        bytes: coachRecordings.bytes,
        updatedAt: coachRecordings.updatedAt,
      })
      .from(coachRecordings)
      .orderBy(asc(coachRecordings.tone), asc(coachRecordings.event));
    return { items: rows.map(toDto) };
  }

  /** The audio. The app adds `?v=<updatedAt>` so a new take never plays an old cached one. */
  @Get(':id')
  async audio(@Param('id', new ZodValidationPipe(coachRecordingIdSchema)) id: string, @Res() res: ResponseLike): Promise<void> {
    const [row] = await this.db.select().from(coachRecordings).where(eq(coachRecordings.id, id)).limit(1);
    if (!row) throw new NotFoundException('Recording not found');
    res.setHeader('content-type', row.contentType);
    res.setHeader('cache-control', 'private, max-age=31536000, immutable');
    res.send(Buffer.from(row.audio));
  }

  /** Saves or replaces a take: raw audio in the body, the line it belongs to in the query. Admins only. */
  @Put(':id')
  async save(
    @CurrentUser() user: User,
    @Param('id', new ZodValidationPipe(coachRecordingIdSchema)) id: string,
    @Query(new ZodValidationPipe(coachRecordingMetaSchema.extend({ form: coachRecordingMetaSchema.shape.form.optional() })))
    meta: Omit<CoachRecordingMeta, 'form'> & { form?: CoachRecordingMeta['form'] },
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
    @Res() res: ResponseLike,
  ): Promise<void> {
    if (!isAdmin(user)) throw new ForbiddenException('Only admins record the Coach');
    const type = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    if (!(COACH_RECORDING_TYPES as readonly string[]).includes(type)) throw new BadRequestException(`Unsupported audio type: ${type || 'none'}`);
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(0);
    if (!bytes.length) throw new BadRequestException('The recording is empty');
    if (bytes.length > COACH_RECORDING_MAX_BYTES) throw new BadRequestException('The recording is too long');
    const row = {
      id,
      tone: meta.tone,
      locale: meta.locale,
      event: meta.event,
      form: meta.form ?? null,
      text: meta.text,
      contentType: (contentType ?? type).trim(),
      audio: Buffer.from(bytes),
      bytes: bytes.length,
      updatedAt: Date.now(),
    };
    await this.db.insert(coachRecordings).values(row).onConflictDoUpdate({ target: coachRecordings.id, set: row });
    const { audio: _audio, ...rest } = row;
    res.status(200).setHeader('content-type', 'application/json');
    res.send(JSON.stringify(toDto(rest)));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id', new ZodValidationPipe(coachRecordingIdSchema)) id: string): Promise<void> {
    if (!isAdmin(user)) throw new ForbiddenException('Only admins record the Coach');
    await this.db.delete(coachRecordings).where(eq(coachRecordings.id, id));
  }
}
