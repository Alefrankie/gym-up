// tests/nutrition/analyze-route-handler.test.ts
//
// TDD red-phase for the `POST /api/nutrition/analyze` handler.
//
// The handler is extracted into a pure function
// (`analyzeRouteHandler`) so the Astro route file stays a thin
// wrapper. Tests inject fake `authService` + `useCase` deps — no
// mocking of the full composition module, no Astro runtime needed.
//
// Coverage:
//   - 401 when session is missing or invalid
//   - 400 (INVALID_INPUT) for every validation failure path
//   - 200 happy path with the typed response shape
//   - 502 (AI_UNRECOGNIZED) when adapter throws
//   - 504 (AI_TIMEOUT) when adapter throws
//   - 500 (INTERNAL) for any other error

import { describe, it, expect, vi } from 'vitest';
import { analyzeRouteHandler } from '@/lib/contexts/nutrition/application/analyze-route-handler';
import { InMemoryAIAnalysisAdapter } from '@/lib/contexts/nutrition/infrastructure/ai/in-memory-ai-analysis.adapter';
import { AnalyzeMealUseCase } from '@/lib/contexts/nutrition/application/analyze-meal.use-case';
import {
  AIUnrecognizedFoodError,
  AITimeoutError,
} from '@/lib/contexts/nutrition/domain/errors';
import type { AuthService, User } from '@/lib/contexts/auth/auth.types';
import type { AnalyzeResponse } from '@/lib/contexts/nutrition/domain/nutrition.types';

const SAMPLE_USER: User = {
  id: 'user-1',
  email: 'a@b.com',
  displayName: 'Test',
  routineType: 'hombre',
  weightUnit: 'kg',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

// Tiny valid base64 string that decodes to 4 bytes.
const VALID_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64');

function makeAuth(overrides: Partial<AuthService> = {}): AuthService {
  return {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(async () => SAMPLE_USER),
    ...overrides,
  };
}

function buildUseCase() {
  const adapter = new InMemoryAIAnalysisAdapter();
  const useCase = new AnalyzeMealUseCase(adapter);
  return { useCase, adapter };
}

function makeRequest(body: unknown, cookie?: string): Request {
  return new Request('http://localhost/api/nutrition/analyze', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('analyzeRouteHandler', () => {
  describe('auth', () => {
    it('returns 401 when session cookie is missing', async () => {
      const { useCase } = buildUseCase();
      const auth = makeAuth();
      const req = makeRequest({ format: 'jpg', imageBase64: VALID_BASE64 });

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(401);
      const body = (await res.json()) as AnalyzeResponse;
      if ('code' in body) {
        expect(body.code).toBe('UNAUTHORIZED');
      } else {
        throw new Error('expected error response');
      }
    });

    it('returns 401 when session is unknown', async () => {
      const { useCase } = buildUseCase();
      const auth = makeAuth({
        getCurrentUser: vi.fn(async () => null),
      });
      const req = makeRequest(
        { format: 'jpg', imageBase64: VALID_BASE64 },
        'session_id=invalid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(401);
    });
  });

  describe('validation — 400 INVALID_INPUT', () => {
    it('returns 400 when body is not JSON', async () => {
      const { useCase } = buildUseCase();
      const auth = makeAuth();
      const req = new Request('http://localhost/api/nutrition/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: 'session_id=valid' },
        body: 'not-json{',
      });

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(400);
      const body = (await res.json()) as AnalyzeResponse;
      if ('code' in body) {
        expect(body.code).toBe('INVALID_INPUT');
      } else {
        throw new Error('expected error response');
      }
    });

    it('returns 400 when format is missing', async () => {
      const { useCase } = buildUseCase();
      const auth = makeAuth();
      const req = makeRequest(
        { imageBase64: VALID_BASE64 },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when format is unsupported', async () => {
      const { useCase } = buildUseCase();
      const auth = makeAuth();
      const req = makeRequest(
        { format: 'gif', imageBase64: VALID_BASE64 },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when imageBase64 is empty', async () => {
      const { useCase } = buildUseCase();
      const auth = makeAuth();
      const req = makeRequest(
        { format: 'jpg', imageBase64: '' },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when base64 is malformed', async () => {
      const { useCase } = buildUseCase();
      const auth = makeAuth();
      const req = makeRequest(
        { format: 'jpg', imageBase64: '!!!not-base64!!!' },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when decoded bytes exceed 5MB', async () => {
      const { useCase } = buildUseCase();
      const auth = makeAuth();
      // 5MB + 1 byte — just over the limit. Larger payloads slow the
      // regex check; this is the smallest size that triggers the check.
      const big = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');
      const req = makeRequest(
        { format: 'jpg', imageBase64: big },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      if (res.status !== 400) {
        const body = await res.json();
        console.error('unexpected response', res.status, body);
      }
      expect(res.status).toBe(400);
    });

    it('returns 400 when data URL format does not match body format', async () => {
      const { useCase } = buildUseCase();
      const auth = makeAuth();
      const req = makeRequest(
        { format: 'jpg', imageBase64: `data:image/png;base64,${VALID_BASE64}` },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(400);
    });

    it('accepts a data URL prefix when format matches', async () => {
      const { useCase, adapter } = buildUseCase();
      adapter.setNextResult({
        total_calories: 100,
        total_protein: 0,
        total_carbs: 25,
        total_fat: 0,
        food_items: [{ name: 'Apple', estimated_calories: 100, estimated_protein: 0, estimated_carbs: 25, estimated_fat: 0 }],
      });
      const auth = makeAuth();
      const req = makeRequest(
        { format: 'jpg', imageBase64: `data:image/jpeg;base64,${VALID_BASE64}` },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(200);
    });
  });

  describe('happy path — 200', () => {
    it('returns the typed AIAnalysisResult', async () => {
      const { useCase, adapter } = buildUseCase();
      const expected = {
        total_calories: 500,
        total_protein: 30,
        total_carbs: 60,
        total_fat: 15,
        food_items: [
          { name: 'X', estimated_calories: 500, estimated_protein: 30, estimated_carbs: 60, estimated_fat: 15 },
        ],
      };
      adapter.setNextResult(expected);
      const auth = makeAuth();
      const req = makeRequest(
        { format: 'jpg', imageBase64: VALID_BASE64 },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(200);
      const body = (await res.json()) as AnalyzeResponse;
      expect(body).toEqual({ result: expected, rawResponse: null });
    });
  });

  describe('AI error paths', () => {
    it('returns 502 when adapter throws AIUnrecognizedFoodError', async () => {
      const { useCase, adapter } = buildUseCase();
      adapter.setNextError(new AIUnrecognizedFoodError());
      const auth = makeAuth();
      const req = makeRequest(
        { format: 'jpg', imageBase64: VALID_BASE64 },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(502);
      const body = (await res.json()) as AnalyzeResponse;
      if ('code' in body) {
        expect(body.code).toBe('AI_UNRECOGNIZED');
      } else {
        throw new Error('expected error response');
      }
    });

    it('returns 504 when adapter throws AITimeoutError', async () => {
      const { useCase, adapter } = buildUseCase();
      adapter.setNextError(new AITimeoutError('boom', 30_000));
      const auth = makeAuth();
      const req = makeRequest(
        { format: 'jpg', imageBase64: VALID_BASE64 },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(504);
      const body = (await res.json()) as AnalyzeResponse;
      if ('code' in body) {
        expect(body.code).toBe('AI_TIMEOUT');
      } else {
        throw new Error('expected error response');
      }
    });

    it('returns 500 for any other error', async () => {
      const { useCase, adapter } = buildUseCase();
      adapter.setNextError(new Error('unexpected'));
      const auth = makeAuth();
      const req = makeRequest(
        { format: 'jpg', imageBase64: VALID_BASE64 },
        'session_id=valid',
      );

      const res = await analyzeRouteHandler({ authService: auth, useCase }, req);

      expect(res.status).toBe(500);
      const body = (await res.json()) as AnalyzeResponse;
      if ('code' in body) {
        expect(body.code).toBe('INTERNAL');
      } else {
        throw new Error('expected error response');
      }
    });
  });
});