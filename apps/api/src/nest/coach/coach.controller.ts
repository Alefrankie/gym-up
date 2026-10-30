import { BadGatewayException, Controller, Get, Inject, Query, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { coachVoiceQuerySchema, type CoachVoiceQuery } from '@gym-up/contracts';
import type { CoachSpeech } from '@/lib/contexts/coach/coach-speech';
import { AuthGuard } from '../common/auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { COACH_SPEECH } from '../tokens';

interface ResponseLike {
  setHeader(name: string, value: string): void;
  send(body: unknown): void;
}

/** The Coach's cloud voice. Signed-in users only (each new line costs a generation); 503 without Workers AI. */
@Controller('coach')
@UseGuards(AuthGuard)
export class CoachController {
  constructor(@Inject(COACH_SPEECH) private readonly speech: CoachSpeech | null) {}

  @Get('voice')
  async voice(@Query(new ZodValidationPipe(coachVoiceQuerySchema)) query: CoachVoiceQuery, @Res() res: ResponseLike): Promise<void> {
    if (!this.speech) throw new ServiceUnavailableException('Coach voice is not configured');
    const audio = await this.speech.speak(query).catch((e: unknown) => {
      console.error('coach voice failed', e);
      throw new BadGatewayException('The Coach voice provider failed');
    });
    res.setHeader('content-type', audio.contentType);
    // Same voice + text = same audio forever: the app keeps it on the device.
    res.setHeader('cache-control', 'private, max-age=31536000, immutable');
    res.setHeader('x-coach-voice-cache', audio.cached ? 'hit' : 'miss');
    res.send(Buffer.from(audio.bytes));
  }
}
