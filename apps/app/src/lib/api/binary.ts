import { API_URL } from './config';
import { ApiRequestError, NetworkError } from './errors';
import { tokenStore } from './token';

async function send(path: string, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
  } catch {
    throw new NetworkError();
  }
  if (!res.ok) {
    if (res.status === 401) tokenStore.clear();
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* not JSON */
    }
    throw new ApiRequestError(res.status, message);
  }
  return res;
}

/** Downloads an owner-only image (an `<img>` tag cannot send the bearer token). */
export async function fetchBlob(path: string): Promise<Blob> {
  return (await send(path, { method: 'GET' })).blob();
}

/** Uploads raw bytes (photos). Idempotent on the server by the id in the path. */
export async function uploadBlob(path: string, blob: Blob): Promise<void> {
  await send(path, { method: 'PUT', body: blob, headers: { 'content-type': blob.type } });
}

export async function deleteRequest(path: string): Promise<void> {
  await send(path, { method: 'DELETE' });
}
