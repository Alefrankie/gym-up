// src/lib/contexts/coach/d1-voice-budget.ts
//
// Daily character budget for the Coach cloud voice, kept in D1 (one row per UTC day, the day Workers AI's free
// allocation resets). The reservation is a single conditional upsert, so two requests cannot both slip past the cap.

import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { VoiceBudget } from './coach-speech';

/** 3,000 characters ≈ 8,200 neurons: under Workers AI's 10,000 free neurons a day, with room to spare. */
export const DAILY_VOICE_CHARS = 3000;

export class D1VoiceBudget implements VoiceBudget {
  constructor(
    private readonly db: Db,
    private readonly cap = DAILY_VOICE_CHARS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async spend(chars: number): Promise<boolean> {
    if (chars > this.cap) return false;
    const day = this.now().toISOString().slice(0, 10);
    const rows = await this.db.all<{ chars: number }>(sql`
      INSERT INTO coach_voice_usage (day, chars) VALUES (${day}, ${chars})
      ON CONFLICT(day) DO UPDATE SET chars = chars + excluded.chars
      WHERE coach_voice_usage.chars + excluded.chars <= ${this.cap}
      RETURNING chars`);
    return rows.length > 0;
  }
}
