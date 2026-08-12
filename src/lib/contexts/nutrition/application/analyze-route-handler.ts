// src/lib/contexts/nutrition/application/analyze-route-handler.ts
//
// Pure request handler for `POST /api/nutrition/analyze`. Extracted
// from the Astro route file so it can be unit-tested with fake deps
// (no Astro runtime, no full-module mocking).
//
// Pipeline:
//   1. Resolve session via `AuthService.getCurrentUser(sessionId)`.
//   2. Parse JSON body. Reject malformed / wrong-shape bodies.
//   3. Validate `format` against `PhotoRules.AcceptedFormats`.
//   4. Strip optional `data:image/<fmt>;base64,` prefix; verify it
//      matches the body's `format` field.
//   5. Decode base64 → bytes; verify decoded length ≤ 5MB.
//   6. Call `useCase.execute({ bytes, format })`.
//   7. Map typed errors to status codes; respond with JSON envelope.
//
// The handler is the single seam between HTTP and the domain — all
// validation lives here so the use case stays thin. The endpoint file
// (`src/pages/api/nutrition/analyze.ts`) is a thin Astro wrapper.

import { AnalyzeMealUseCase } from './analyze-meal.use-case';
import {
  InvalidPhotoError,
  mapNutritionError,
  UnauthorizedError,
} from '../domain/errors';
import {
  DATA_URL_PREFIX_PATTERN,
  PhotoRules,
  isValidBase64Payload,
} from '../domain/nutrition.constants';
import type { AuthService } from '@/lib/contexts/auth/auth.types';
import type {
  AnalyzeErrorResponse,
  AnalyzeRequestBody,
  AnalyzeResponse,
  PhotoFormat,
} from '../domain/nutrition.types';

export interface AnalyzeRouteDeps {
  authService: AuthService;
  useCase: AnalyzeMealUseCase;
}

const SESSION_COOKIE_NAME = 'session_id';

export async function analyzeRouteHandler(
  deps: AnalyzeRouteDeps,
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
    const body = parseBody(raw);

    // 3-5. Validate + decode
    const { bytes, format } = decodeAndValidate(body);

    // 6. Use case
    const result = await deps.useCase.execute({ bytes, format });

    // 7. Success response
    const payload: AnalyzeResponse = {
      result,
      rawResponse: null,
    };
    return json(payload, 200);
  } catch (err) {
    const mapping = mapNutritionError(err);
    const payload: AnalyzeErrorResponse = {
      error: mapping.message,
      code: mapping.code,
    };
    return json(payload, mapping.status);
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

function parseBody(raw: unknown): AnalyzeRequestBody {
  if (raw === null || typeof raw !== 'object') {
    throw new InvalidPhotoError(
      'Bad request: body must be a JSON object.',
      'missing_fields',
    );
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.format !== 'string') {
    throw new InvalidPhotoError(
      'Bad request: missing or invalid `format` field.',
      'missing_fields',
      { format: obj.format },
    );
  }
  if (!isPhotoFormat(obj.format)) {
    throw new InvalidPhotoError(
      `Unsupported format: ${obj.format}. Allowed: jpg, png, webp.`,
      'unsupported_format',
      { format: obj.format },
    );
  }
  if (typeof obj.imageBase64 !== 'string' || obj.imageBase64.length === 0) {
    throw new InvalidPhotoError(
      'Bad request: missing or empty `imageBase64` field.',
      'missing_fields',
    );
  }
  return {
    format: obj.format,
    imageBase64: obj.imageBase64,
  };
}

function isPhotoFormat(value: unknown): value is PhotoFormat {
  return value === 'jpg' || value === 'png' || value === 'webp';
}

function decodeAndValidate(body: AnalyzeRequestBody): {
  bytes: Uint8Array;
  format: PhotoFormat;
} {
  const { format, imageBase64 } = body;

  // Strip optional data URL prefix; verify the prefix's format matches
  // the body's `format` field so the client cannot smuggle a PNG into
  // a `format: 'jpg'` request.
  let payload = imageBase64;
  const match = DATA_URL_PREFIX_PATTERN.exec(imageBase64);
  if (match) {
    const prefixFormat = match[1].toLowerCase();
    const normalizedPrefix = prefixFormat === 'jpeg' ? 'jpg' : prefixFormat;
    if (normalizedPrefix !== format) {
      throw new InvalidPhotoError(
        `Bad request: data URL declares ${prefixFormat} but body says ${format}.`,
        'data_url_format_mismatch',
        { prefixFormat, format },
      );
    }
    payload = match[2];
  }

  // Validate base64 alphabet + length BEFORE decoding — Node's
  // Buffer.from(s, 'base64') is lenient and silently drops invalid
  // characters, which would let a malformed payload slip through and
  // produce a valid-but-wrong image. The manual alphabet check rejects
  // it here (regex stack-overflows on strings ≥ ~5MB).
  if (!isValidBase64Payload(payload)) {
    throw new InvalidPhotoError(
      'Bad request: malformed base64 payload.',
      'malformed_base64',
    );
  }

  // Decode base64 → bytes. Use Buffer when available (Node),
  // fall back to atob (browser / Edge runtime).
  let bytes: Uint8Array;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Buf = (globalThis as any).Buffer;
    if (typeof Buf !== 'undefined') {
      bytes = new Uint8Array( Buf.from(payload, 'base64'));
    } else {
      const binary = atob(payload);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    }
  } catch {
    throw new InvalidPhotoError(
      'Bad request: malformed base64 payload.',
      'malformed_base64',
    );
  }

  if (bytes.length === 0) {
    throw new InvalidPhotoError(
      'Bad request: decoded image is empty.',
      'malformed_base64',
    );
  }

  if (bytes.length > PhotoRules.MaxSizeBytes) {
    throw new InvalidPhotoError(
      `Photo too large. Max ${PhotoRules.MaxSizeBytes} bytes (got ${bytes.length}).`,
      'size_exceeded',
      { actualBytes: bytes.length, maxBytes: PhotoRules.MaxSizeBytes },
    );
  }

  return { bytes, format };
}