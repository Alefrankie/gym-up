// src/lib/contexts/progress/application/get-exercise-history.use-case.ts
//
// Use case: fetch exercise history aggregated by calendar day.
// Per architecture readme invariants:
//   - weight = max(weight) per day (kg)
//   - volume = Σ(reps × weight) per day (kg) — NOT set_number × reps × weight
//     (readme originally said set_number × reps × weight; that was a typo
//     — corrected in story-3.2 per Q5)
//
// Aggregation happens in this layer (not the repo) so the SQL stays
// straightforward and the use case remains unit-testable with real repos.

import { type DateRange } from '../domain/progress.constants';
import type { RawEntry } from '../domain/ports/ProgressRepository';
import { type ProgressRepository } from '../domain/ports/ProgressRepository';
import type {
  ChartDataPoint,
  GetExerciseHistoryInput,
} from '../domain/progress.types';

const MS_PER_DAY = 86_400_000;

export class GetExerciseHistoryUseCase {
  constructor(private readonly progressRepository: ProgressRepository) {}

  /**
   * @param input.range    `'7d' | '30d' | 'all'` — date filter.
   * @param now            Reference "today" for the date filter.
   *                       Defaults to `new Date()`. Pass an explicit value
   *                       in tests to make them deterministic.
   */
  async execute(
    input: GetExerciseHistoryInput,
    now: Date = new Date(),
  ): Promise<ChartDataPoint[]> {
    const since = calculateCutoff(input.range, now);
    const entries = await this.progressRepository.getExerciseHistory(
      input.userId,
      input.exerciseId,
      since,
    );
    return aggregateByDate(entries);
  }
}

/**
 * "Last N days" in natural-day semantics (per Phase 1.5 discrepancy #4):
 *   `7d`  → cutoff = start of (today - 6 days)  → 7 calendar days inclusive
 *   `30d` → cutoff = start of (today - 29 days) → 30 calendar days inclusive
 *   `all` → no cutoff
 */
export function calculateCutoff(range: DateRange, now: Date): Date | null {
  if (range === 'all') {
    return null;
  }
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const days = range === '7d' ? 7 : 30;
  return new Date(startOfToday.getTime() - (days - 1) * MS_PER_DAY);
}

/**
 * Aggregate raw entries (per-set rows) into one chart point per UTC day.
 * - `weight` = max weight lifted that day
 * - `volume` = sum of (reps × weight) for all completed sets that day
 *
 * Exported for unit testing.
 */
export function aggregateByDate(entries: RawEntry[]): ChartDataPoint[] {
  const byDate = new Map<string, { weight: number; volume: number }>();
  for (const entry of entries) {
    const dateKey = entry.workoutDate.toISOString().split('T')[0];
    const existing = byDate.get(dateKey) ?? { weight: 0, volume: 0 };
    existing.weight = Math.max(existing.weight, entry.weight);
    existing.volume += entry.reps * entry.weight;
    byDate.set(dateKey, existing);
  }
  return Array.from(byDate.entries())
    .map(([date, { weight, volume }]) => ({ date, weight, volume }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
