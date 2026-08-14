// src/pages/api/nutrition/daily-summary.ts
//
// GET — today's calorie summary (consumed vs goal).

import type { APIRoute } from 'astro';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import { getGetDailyCalorieSummaryUseCase } from '@/lib/contexts/nutrition/nutrition.composition';
import { dailySummaryRouteHandler } from '@/lib/contexts/nutrition/application/daily-summary-route-handler';

export const GET: APIRoute = async ({ request }) => {
  return dailySummaryRouteHandler(
    {
      authService: getAuthService(),
      useCase: getGetDailyCalorieSummaryUseCase(),
    },
    request,
  );
};
