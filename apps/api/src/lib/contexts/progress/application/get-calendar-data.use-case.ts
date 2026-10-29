// src/lib/contexts/progress/application/get-calendar-data.use-case.ts
//
// Use case: fetch the last N calendar days, each annotated with whether
// the user had a completed workout. Used by the calendar grid (story 3.3)
// but the port + use case are defined here so the composition root is
// complete for the progress context.
//
// Default N = CalendarRules.DisplayDays (28) per architecture readme.

import { CalendarRules } from '../domain/progress.constants';
import type { CalendarDay, GetCalendarDataInput } from '../domain/progress.types';
import { type ProgressRepository } from '../domain/ports/ProgressRepository';

export class GetCalendarDataUseCase {
  constructor(private readonly progressRepository: ProgressRepository) {}

  async execute(input: GetCalendarDataInput): Promise<CalendarDay[]> {
    const days = input.days ?? CalendarRules.DisplayDays;
    return this.progressRepository.getCalendarData(input.userId, days);
  }
}
