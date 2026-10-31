import { Controller, Get, Inject, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { coachRecordingIdSchema, type CoachCatalog, type CoachRecordingDto, type CoachRecordingList } from '@gym-up/contracts';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { studioActive, studioCustomLines, studioOverrides, studioTakes } from '@db/schema';
import type { Db } from '@/lib/db/client';
import { AuthGuard } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DB } from '../tokens';

interface ResponseLike {
  setHeader(name: string, value: string): void;
  send(body: unknown): void;
}

// The text a line says now: an edit of a built-in line, an added line's own text, or the take's text.
const currentText = sql<string>`coalesce(${studioOverrides.text}, ${studioCustomLines.text}, ${studioTakes.text})`;
// Only takes that say the current text, of lines that are not waiting for approval.
const playable = and(
  sql`${studioTakes.text} = coalesce(${studioOverrides.text}, ${studioCustomLines.text}, ${studioTakes.text})`,
  or(isNull(studioCustomLines.lineId), eq(studioCustomLines.status, 'approved')),
);

/**
 * The Coach's recorded lines as the app plays them: for each line, only the take the admin made active in the voice
 * studio, and only while it says the line's current text. Anyone signed in can list and play them.
 */
@Controller('coach/recordings')
@UseGuards(AuthGuard)
export class CoachRecordingsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async list(): Promise<CoachRecordingList> {
    const rows = await this.db
      .select({
        id: studioActive.lineId,
        tone: studioTakes.tone,
        locale: studioTakes.locale,
        event: studioTakes.event,
        form: studioTakes.form,
        text: currentText,
        contentType: studioTakes.contentType,
        bytes: studioTakes.bytes,
        // A new take, or another take made active, changes the version so the app downloads it again.
        updatedAt: sql<number>`max(${studioTakes.updatedAt}, ${studioActive.chosenAt})`,
      })
      .from(studioActive)
      .innerJoin(studioTakes, eq(studioTakes.id, studioActive.takeId))
      .leftJoin(studioOverrides, eq(studioOverrides.lineId, studioActive.lineId))
      .leftJoin(studioCustomLines, eq(studioCustomLines.lineId, studioActive.lineId))
      .where(playable)
      .orderBy(asc(studioTakes.tone), asc(studioTakes.event));
    return {
      items: rows.map((r) => ({
        ...r,
        tone: r.tone as CoachRecordingDto['tone'],
        locale: r.locale as CoachRecordingDto['locale'],
        form: (r.form ?? null) as CoachRecordingDto['form'],
        updatedAt: Number(r.updatedAt),
      })),
    };
  }

  /** The active take of a line. The app adds `?v=<updatedAt>` so a new pick never plays an old cached take. */
  @Get(':id')
  async audio(@Param('id', new ZodValidationPipe(coachRecordingIdSchema)) id: string, @Res() res: ResponseLike): Promise<void> {
    const [row] = await this.db
      .select({ audio: studioTakes.audio, contentType: studioTakes.contentType })
      .from(studioActive)
      .innerJoin(studioTakes, eq(studioTakes.id, studioActive.takeId))
      .leftJoin(studioOverrides, eq(studioOverrides.lineId, studioActive.lineId))
      .leftJoin(studioCustomLines, eq(studioCustomLines.lineId, studioActive.lineId))
      .where(and(eq(studioActive.lineId, id), playable))
      .limit(1);
    if (!row) throw new NotFoundException('Recording not found');
    res.setHeader('content-type', row.contentType);
    res.setHeader('cache-control', 'private, max-age=31536000, immutable');
    res.send(Buffer.from(row.audio));
  }
}

/** Lines added in the studio (approved) and edited texts: the app merges them into its catalog and keeps them offline. */
@Controller('coach/catalog')
@UseGuards(AuthGuard)
export class CoachCatalogController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async catalog(): Promise<CoachCatalog> {
    const custom = await this.db
      .select({
        lineId: studioCustomLines.lineId,
        groupId: studioCustomLines.groupId,
        form: studioCustomLines.form,
        tone: studioCustomLines.tone,
        locale: studioCustomLines.locale,
        event: studioCustomLines.event,
        text: studioCustomLines.text,
      })
      .from(studioCustomLines)
      .where(eq(studioCustomLines.status, 'approved'))
      .orderBy(asc(studioCustomLines.createdAt));
    const overrides = await this.db
      .select({ lineId: studioOverrides.lineId, originalText: studioOverrides.originalText, text: studioOverrides.text })
      .from(studioOverrides);
    return { custom: custom as CoachCatalog['custom'], overrides };
  }
}
