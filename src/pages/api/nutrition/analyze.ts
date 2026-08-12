// src/pages/api/nutrition/analyze.ts
//
// POST endpoint for AI food-photo analysis (story-5.1).
//
// Body: JSON { format: 'jpg'|'png'|'webp', imageBase64: string }
// Auth: session_id cookie via `getAuthService().getCurrentUser()`
// Response: JSON `AnalyzeResponse` (see `nutrition.types.ts`).
//
// All business logic lives in `analyzeRouteHandler` (testable without
// an Astro runtime). This file is the thin Astro glue.

import type { APIRoute } from 'astro';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import { getAnalyzeMealUseCase } from '@/lib/contexts/nutrition/nutrition.composition';
import { analyzeRouteHandler } from '@/lib/contexts/nutrition/application/analyze-route-handler';

export const POST: APIRoute = async ({ request }) => {
  return analyzeRouteHandler(
    {
      authService: getAuthService(),
      useCase: getAnalyzeMealUseCase(),
    },
    request,
  );
};