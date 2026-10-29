// src/lib/contexts/nutrition/application/list-route-handler.ts
//
// Pure request handler for `GET /api/nutrition/entries`.
// Returns the user's nutrition history (newest first).

import type { AuthService } from '@/lib/contexts/auth/auth.types';
import type { GetNutritionHistoryUseCase } from './get-nutrition-history.use-case';
import { mapNutritionError, UnauthorizedError } from '../domain/errors';

export interface ListRouteDeps {
  authService: AuthService;
  useCase: GetNutritionHistoryUseCase;
}

const SESSION_COOKIE_NAME = 'session_id';

export async function listRouteHandler(
  deps: ListRouteDeps,
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

    const entries = await deps.useCase.execute({ userId: user.id });
    return json({ entries, count: entries.length }, 200);
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
