// src/lib/contexts/progress/domain/progress.constants.ts
//
// Domain constants for the Progress context.
// Per docs/architecture/contexts/progress/readme.md "Domain / progress.constants.ts".

/**
 * Date range filter options for the exercise history chart.
 * Per FR-PR-003 + readme.
 *
 * - `7d`  → last 7 calendar days (today + 6 previous, inclusive)
 * - `30d` → last 30 calendar days (today + 29 previous, inclusive)
 * - `all` → all time
 */
export const DateRanges = {
  Last7Days: '7d',
  Last30Days: '30d',
  All: 'all',
} as const;

export type DateRange = (typeof DateRanges)[keyof typeof DateRanges];

/**
 * Calendar + streak rules.
 * Per readme.
 */
export const CalendarRules = {
  /** 4 weeks of days shown on the calendar grid. */
  DisplayDays: 28,
  /** A streak is broken if more than 1 day passes without a completed workout. */
  MaxStreakGapDays: 1,
} as const;
