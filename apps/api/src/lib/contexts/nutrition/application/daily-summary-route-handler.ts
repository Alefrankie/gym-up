// src/lib/contexts/nutrition/application/daily-summary-route-handler.ts
//
// Pure request handler for `GET /api/nutrition/daily-summary`.
// Returns today's calorie summary (consumed vs goal).

import type { AuthService } from '@/lib/contexts/auth/auth.types';
import type { GetDailyCalorieSummaryUseCase } from './get-daily-calorie-summary.use-case';
import { mapNutritionError, UnauthorizedError } from '../domain/errors';

export interface DailySummaryRouteDeps {
  authService: AuthService;
  useCase: GetDailyCalorieSummaryUseCase;
}

const SESSION_COOKIE_NAME = 'session_id';

export async function dailySummaryRouteHandler(
  deps: DailySummaryRouteDeps,
  request: Request,
): Promise<Response> {
  try {
    const sessionId = readSessionCookie(request);
    const user = sessionId
      ? await deps.authService.getCurrentUser(sessionId)
      : null;
    if (!user) {
      throw new UnauthorizedError();
    }

    const summary = await deps.useCase.execute({ userId: user.id });
    return json(summary, 200);
  } catch (err) {
    const mapping = mapNutritionError(err);
    return json({ error: mapping.message, code: mapping.code }, mapping.status);
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      const value = rest.join('=').trim();
      return value || null;
    }
  }
  return null;
}
