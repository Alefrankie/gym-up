// src/lib/contexts/nutrition/domain/errors.ts
//
// Typed domain errors for the nutrition context (story-5.1 scope).
//
// Each error class carries enough context for the endpoint layer to
// build the user-facing message AND the stable error code that maps to
// an HTTP status. The error code values match `AnalyzeErrorResponse.code`
// in `nutrition.types.ts`.

import type { PhotoFormat } from './nutrition.types';

/** Base class for every domain error in the nutrition context. */
export abstract class NutritionDomainError extends Error {
  abstract readonly code: string;
}

/** 400 — missing field, malformed base64, bad format, size > 5MB. */
export class InvalidPhotoError extends NutritionDomainError {
  readonly code = 'INVALID_INPUT' as const;

  constructor(
    message: string,
    public readonly reason:
      | 'missing_fields'
      | 'malformed_base64'
      | 'unsupported_format'
      | 'size_exceeded'
      | 'data_url_format_mismatch',
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'InvalidPhotoError';
  }
}

/** 401 — no session cookie or invalid session. */
export class UnauthorizedError extends NutritionDomainError {
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message = 'Unauthorized: no valid session') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** 502 — AI provider returned unparseable, empty, or unrecognized food. */
export class AIUnrecognizedFoodError extends NutritionDomainError {
  readonly code = 'AI_UNRECOGNIZED' as const;
  constructor(
    message = 'Food not recognized. Try a clearer photo or better lighting.',
  ) {
    super(message);
    this.name = 'AIUnrecognizedFoodError';
  }
}

/** 504 — AI provider call exceeded `AIAnalysisRules.TimeoutMs`. */
export class AITimeoutError extends NutritionDomainError {
  readonly code = 'AI_TIMEOUT' as const;
  constructor(
    message = 'Analysis took too long. Try again.',
    public readonly timeoutMs: number,
  ) {
    super(message);
    this.name = 'AITimeoutError';
  }
}

/** 500 — internal failure (missing API key, unexpected throw, etc.). */
export class MissingApiKeyError extends NutritionDomainError {
  readonly code = 'INTERNAL' as const;
  constructor(
    public readonly provider: string,
    public readonly envVar: string,
  ) {
    super(
      `Missing API key: ${envVar} is not set (required by ${provider} adapter).`,
    );
    this.name = 'MissingApiKeyError';
  }
}

/**
 * Helper used by the endpoint layer to map a typed error to the
 * (HTTP status, error code, message) triple for the JSON response.
 */
export interface ErrorMapping {
  status: number;
  code: AnalyzeErrorCode;
  message: string;
}

export type AnalyzeErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'AI_UNRECOGNIZED'
  | 'AI_TIMEOUT'
  | 'INTERNAL';

export function mapNutritionError(err: unknown): ErrorMapping {
  if (err instanceof InvalidPhotoError) {
    return { status: 400, code: 'INVALID_INPUT', message: err.message };
  }
  if (err instanceof UnauthorizedError) {
    return { status: 401, code: 'UNAUTHORIZED', message: err.message };
  }
  if (err instanceof AIUnrecognizedFoodError) {
    return { status: 502, code: 'AI_UNRECOGNIZED', message: err.message };
  }
  if (err instanceof AITimeoutError) {
    return { status: 504, code: 'AI_TIMEOUT', message: err.message };
  }
  if (err instanceof MissingApiKeyError) {
    return { status: 500, code: 'INTERNAL', message: 'Internal server error' };
  }
  return { status: 500, code: 'INTERNAL', message: 'Internal server error' };
}

/**
 * Type guard used by the endpoint layer to assert a parsed body has
 * the shape of `AnalyzeRequestBody`. Centralized so the same shape
 * rules apply to direct calls and to test fixtures.
 */
export function isPhotoFormat(value: unknown): value is PhotoFormat {
  return value === 'jpg' || value === 'png' || value === 'webp';
}

// =============================================================
// Story 5.3 — Save/Goal/History errors
// =============================================================

/** Photo exceeds 5MB hard limit (defense in depth on server side). */
export class PhotoSizeExceededError extends NutritionDomainError {
  readonly code = 'INVALID_INPUT' as const;
  constructor(public readonly actualBytes: number) {
    super(`Photo exceeds 5MB (got ${actualBytes} bytes).`);
    this.name = 'PhotoSizeExceededError';
  }
}

/** Photo format not in {jpg, png, webp}. */
export class UnsupportedPhotoFormatError extends NutritionDomainError {
  readonly code = 'INVALID_INPUT' as const;
  constructor(public readonly format: string) {
    super(`Unsupported photo format: ${format}. Allowed: jpg, png, webp.`);
    this.name = 'UnsupportedPhotoFormatError';
  }
}

/** Nutrition entry data violates domain invariants. */
export class InvalidNutritionDataError extends NutritionDomainError {
  readonly code = 'INVALID_INPUT' as const;
  constructor(message: string) {
    super(message);
    this.name = 'InvalidNutritionDataError';
  }
}

/** food_items array is empty (must have >= 1 item). */
export class EmptyFoodItemsError extends NutritionDomainError {
  readonly code = 'INVALID_INPUT' as const;
  constructor() {
    super('food_items must contain at least 1 item.');
    this.name = 'EmptyFoodItemsError';
  }
}

/** Calorie goal outside allowed range [1, 10000]. */
export class InvalidCalorieGoalError extends NutritionDomainError {
  readonly code = 'INVALID_INPUT' as const;
  constructor(public readonly goal: number | null) {
    super(
      `Invalid calorie goal: ${goal}. Must be null or between 1 and 10000.`,
    );
    this.name = 'InvalidCalorieGoalError';
  }
}