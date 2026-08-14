// src/pages/api/nutrition/entries.ts
//
// POST — save a nutrition entry (photo + analysis result).
// GET — list user's nutrition history.
//
// All business logic in save-route-handler / list-route-handler.

import type { APIRoute } from 'astro';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import {
  getSaveNutritionEntryUseCase,
  getGetNutritionHistoryUseCase,
  uploadsRoot,
} from '@/lib/contexts/nutrition/nutrition.composition';
import { saveRouteHandler } from '@/lib/contexts/nutrition/application/save-route-handler';
import { listRouteHandler } from '@/lib/contexts/nutrition/application/list-route-handler';

export const POST: APIRoute = async ({ request }) => {
  return saveRouteHandler(
    {
      authService: getAuthService(),
      useCase: getSaveNutritionEntryUseCase(),
      uploadsRoot,
    },
    request,
  );
};

export const GET: APIRoute = async ({ request }) => {
  return listRouteHandler(
    {
      authService: getAuthService(),
      useCase: getGetNutritionHistoryUseCase(),
    },
    request,
  );
};
