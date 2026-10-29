// src/lib/contexts/nutrition/application/goals-route-handler.ts
//
// Pure request handler for `GET/PUT /api/nutrition/goals`.
// GET returns current goal, PUT sets/clears it.

import type { AuthService } from '@/lib/contexts/auth/auth.types';
import type { SetCalorieGoalUseCase } from './set-calorie-goal.use-case';
import type { NutritionGoalRepository } from '../domain/nutrition-goal-repository';
import {
  mapNutritionError,
  UnauthorizedError,
  InvalidPhotoError,
} from '../domain/errors';
import { CalorieGoalRules } from '../domain/nutrition.constants';

export interface GoalsRouteDeps {
  authService: AuthService;
  setGoalUseCase: SetCalorieGoalUseCase;
  goalRepository: NutritionGoalRepository;
}

const SESSION_COOKIE_NAME = 'session_id';

export async function goalsRouteHandler(
  deps: GoalsRouteDeps,
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

    if (request.method === 'PUT') {
      // Parse body
      let raw: unknown;
      try {
        raw = await request.json();
      } catch {
        throw new InvalidPhotoError(
          'Bad request: malformed JSON body.',
          'missing_fields',
        );
      }

      const obj = raw as Record<string, unknown>;
      let goal: number | null = null;

      if ('goal' in obj) {
        if (obj.goal === null) {
          goal = null;
        } else if (typeof obj.goal === 'number') {
          goal = obj.goal;
        } else {
          throw new InvalidPhotoError(
            'goal must be a number or null.',
            'missing_fields',
          );
        }
      }

      // Validate range
      if (
        goal != null &&
        (!Number.isInteger(goal) ||
          goal < CalorieGoalRules.Min ||
          goal > CalorieGoalRules.Max)
      ) {
        throw new InvalidPhotoError(
          `goal must be null or between ${CalorieGoalRules.Min} and ${CalorieGoalRules.Max}.`,
          'missing_fields',
        );
      }

      await deps.setGoalUseCase.execute({ userId: user.id, goal });
      return json({ goal }, 200);
    }

    // GET
    const current = await deps.goalRepository.getGoal(user.id);
    return json({ goal: current?.dailyCalorieGoal ?? null }, 200);
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
