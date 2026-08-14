// src/lib/contexts/nutrition/application/save-route-handler.ts
//
// Pure request handler for `POST /api/nutrition/entries`.
// Extracted from the Astro route file so it can be unit-tested with
// fake deps (no Astro runtime, no full-module mocking).
//
// Pipeline:
//   1. Resolve session via AuthService.
//   2. Parse JSON body (format, imageBase64, macros, foodItems, userEdited).
//   3. Decode base64 → bytes; validate size ≤ 5MB.
//   4. Call SaveNutritionEntryUseCase.
//   5. Return 201 with saved entry.

import type { AuthService } from '@/lib/contexts/auth/auth.types';
import type { SaveNutritionEntryUseCase } from './save-nutrition-entry.use-case';
import {
  InvalidPhotoError,
  mapNutritionError,
  UnauthorizedError,
} from '../domain/errors';
import {
  PhotoRules,
  DATA_URL_PREFIX_PATTERN,
  isValidBase64Payload,
} from '../domain/nutrition.constants';
import type { FoodItem, PhotoFormat } from '../domain/nutrition.types';

export interface SaveRouteDeps {
  authService: AuthService;
  useCase: SaveNutritionEntryUseCase;
  uploadsRoot: string;
}

const SESSION_COOKIE_NAME = 'session_id';

export async function saveRouteHandler(
  deps: SaveRouteDeps,
  request: Request,
): Promise<Response> {
  try {
    // 1. Auth
    const sessionId = readSessionCookie(request);
    const user = sessionId
      ? await deps.authService.getCurrentUser(sessionId)
      : null;
    if (!user) {
      throw new UnauthorizedError();
    }

    // 2. Parse JSON body
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new InvalidPhotoError(
        'Bad request: malformed JSON body.',
        'malformed_base64',
      );
    }
    const body = parseSaveBody(raw);

    // 3. Decode + validate
    const { bytes, format } = decodeBase64(body.imageBase64, body.format);

    // 4. Use case
    const result = await deps.useCase.execute({
      userId: user.id,
      format,
      imageBytes: bytes,
      totalCalories: body.total_calories,
      totalProtein: body.total_protein,
      totalCarbs: body.total_carbs,
      totalFat: body.total_fat,
      foodItems: body.food_items,
      aiRawResponse: body.ai_raw_response ?? null,
      userEdited: body.user_edited ?? false,
      uploadsRoot: deps.uploadsRoot,
    });

    // 5. Success
    return json({ entry: result.entry }, 201);
  } catch (err) {
    const mapping = mapNutritionError(err);
    return json({ error: mapping.message, code: mapping.code }, mapping.status);
  }
}

// ---------- helpers -----------------------------------------------------

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

interface SaveBody {
  format: string;
  imageBase64: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  food_items: FoodItem[];
  ai_raw_response?: Record<string, unknown> | null;
  user_edited?: boolean;
}

function parseSaveBody(raw: unknown): SaveBody {
  if (raw === null || typeof raw !== 'object') {
    throw new InvalidPhotoError(
      'Bad request: body must be a JSON object.',
      'missing_fields',
    );
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.format !== 'string') {
    throw new InvalidPhotoError('Missing format field.', 'missing_fields');
  }
  if (typeof obj.imageBase64 !== 'string' || obj.imageBase64.length === 0) {
    throw new InvalidPhotoError('Missing imageBase64 field.', 'missing_fields');
  }
  if (!PhotoRules.AcceptedFormats.includes(obj.format as PhotoFormat)) {
    throw new InvalidPhotoError(
      `Unsupported format: ${obj.format}. Use jpg, png, or webp.`,
      'unsupported_format',
    );
  }
  if (typeof obj.total_calories !== 'number' || obj.total_calories < 0) {
    throw new InvalidPhotoError(
      'total_calories must be a non-negative number.',
      'missing_fields',
    );
  }
  if (typeof obj.total_protein !== 'number' || obj.total_protein < 0) {
    throw new InvalidPhotoError(
      'total_protein must be a non-negative number.',
      'missing_fields',
    );
  }
  if (typeof obj.total_carbs !== 'number' || obj.total_carbs < 0) {
    throw new InvalidPhotoError(
      'total_carbs must be a non-negative number.',
      'missing_fields',
    );
  }
  if (typeof obj.total_fat !== 'number' || obj.total_fat < 0) {
    throw new InvalidPhotoError(
      'total_fat must be a non-negative number.',
      'missing_fields',
    );
  }
  if (!Array.isArray(obj.food_items) || obj.food_items.length === 0) {
    throw new InvalidPhotoError(
      'food_items must be a non-empty array.',
      'missing_fields',
    );
  }

  return {
    format: obj.format,
    imageBase64: obj.imageBase64,
    total_calories: obj.total_calories,
    total_protein: obj.total_protein,
    total_carbs: obj.total_carbs,
    total_fat: obj.total_fat,
    food_items: obj.food_items as FoodItem[],
    ai_raw_response: (obj.ai_raw_response as Record<string, unknown>) ?? null,
    user_edited: (obj.user_edited as boolean) ?? false,
  };
}

function decodeBase64(
  imageBase64: string,
  format: string,
): { bytes: Uint8Array; format: PhotoFormat } {
  // Strip optional data-URL prefix
  let payload = imageBase64;
  const dataUrlMatch = imageBase64.match(DATA_URL_PREFIX_PATTERN);
  if (dataUrlMatch) {
    payload = dataUrlMatch[2] ?? '';
    // Verify format matches
    const extractedFormat = dataUrlMatch[1]?.toLowerCase();
    if (extractedFormat === 'jpeg') {
      // jpeg is acceptable, treat as jpg
    } else if (extractedFormat !== format) {
      throw new InvalidPhotoError(
        'Data URL format does not match body format field.',
        'data_url_format_mismatch',
      );
    }
  }

  if (!isValidBase64Payload(payload)) {
    throw new InvalidPhotoError('Malformed base64 payload.', 'malformed_base64');
  }

  const bytes = Buffer.from(payload, 'base64');
  if (bytes.length > PhotoRules.MaxSizeBytes) {
    throw new InvalidPhotoError(
      `Photo exceeds ${PhotoRules.MaxSizeBytes} bytes (got ${bytes.length}).`,
      'size_exceeded',
    );
  }

  return { bytes: new Uint8Array(bytes), format: format as PhotoFormat };
}
