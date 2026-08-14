// src/pages/api/nutrition/goals.ts
//
// GET — current calorie goal.
// PUT — set or clear calorie goal.

import type { APIRoute } from 'astro';
import { getAuthService } from '@/lib/contexts/auth/auth.composition';
import {
  getSetCalorieGoalUseCase,
  getNutritionGoalRepository,
} from '@/lib/contexts/nutrition/nutrition.composition';
import { goalsRouteHandler } from '@/lib/contexts/nutrition/application/goals-route-handler';

export const GET: APIRoute = async ({ request }) => {
  return goalsRouteHandler(
    {
      authService: getAuthService(),
      setGoalUseCase: getSetCalorieGoalUseCase(),
      goalRepository: getNutritionGoalRepository(),
    },
    request,
  );
};

export const PUT: APIRoute = async ({ request }) => {
  return goalsRouteHandler(
    {
      authService: getAuthService(),
      setGoalUseCase: getSetCalorieGoalUseCase(),
      goalRepository: getNutritionGoalRepository(),
    },
    request,
  );
};
