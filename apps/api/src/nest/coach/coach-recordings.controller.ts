import { Controller, Get, Inject, NotFoundException, Param, Res, UseGuards } from '@nestjs/common';
import { coachRecordingIdSchema, type CoachRecordingDto, type CoachRecordingList } from '@gym-up/contracts';
import { asc, eq, sql } from 'drizzle-orm';
import { studioActive, studioTakes } from '@db/schema';
import type { Db } from '@/lib/db/client';
import { AuthGuard } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DB } from '../tokens';

interface ResponseLike {
  setHeader(name: string, value: string): void;
  send(body: unknown): void;
}

/**
 * The Coach's recorded lines as the app plays them: for each line, only the take the admin made active in the voice
 * studio. Anyone signed in can list and play them. Recording happens in the studio (`/studio`).
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
        text: studioTakes.text,
        contentType: studioTakes.contentType,
        bytes: studioTakes.bytes,
        // A new take, or another take made active, changes the version so the app downloads it again.
        updatedAt: sql<number>`max(${studioTakes.updatedAt}, ${studioActive.chosenAt})`,
      })
      .from(studioActive)
      .innerJoin(studioTakes, eq(studioTakes.id, studioActive.takeId))
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
      .where(eq(studioActive.lineId, id))
      .limit(1);
    if (!row) throw new NotFoundException('Recording not found');
    res.setHeader('content-type', row.contentType);
    res.setHeader('cache-control', 'private, max-age=31536000, immutable');
    res.send(Buffer.from(row.audio));
  }
}
