import type { z } from 'zod';
import { apiErrorSchema } from '@gym-up/contracts';
import { API_URL } from './config';
import { tokenStore } from './token';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** zod schema of the response; the response is validated against the shared contract. */
  schema?: z.ZodType<T>;
}

/**
 * Typed fetch wrapper: bearer token, JSON in/out, response validated with the
 * contracts package. A 401 clears the stored token so the UI returns to login.
 */
export async function api<T = void>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!res.ok) {
    if (res.status === 401) tokenStore.clear();
    let message = res.statusText;
    try {
      const parsed = apiErrorSchema.safeParse(await res.json());
      if (parsed.success) message = parsed.data.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiRequestError(res.status, message);
  }

  if (res.status === 204 || !options.schema) return undefined as T;
  return options.schema.parse(await res.json());
}
