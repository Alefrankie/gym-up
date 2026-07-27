// src/lib/auth/cookie-helpers.ts
//
// Cookie helpers for session management.
// Handles httpOnly, SameSite=Lax, Secure in production.

const SESSION_COOKIE_NAME = 'session_id';
const SESSION_COOKIE_PATH = '/';
const SESSION_COOKIE_SAMESITE = 'Lax';

/**
 * Get the session ID from the cookie string.
 * Returns null if no session cookie exists.
 */
export function getSessionIdFromCookie(cookieString: string): string | null {
  const cookies = cookieString.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  
  if (!sessionCookie) {
    return null;
  }
  
  const value = sessionCookie.split('=')[1];
  return value || null;
}

/**
 * Create a Set-Cookie header for the session.
 * httpOnly: true (not accessible via JavaScript)
 * SameSite: Lax
 * Secure: true in production
 * Path: /
 */
export function createSessionCookie(sessionId: string, expiresAt: Date): string {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    `Path=${SESSION_COOKIE_PATH}`,
    `SameSite=${SESSION_COOKIE_SAMESITE}`,
    'HttpOnly',
    `Expires=${expiresAt.toUTCString()}`,
  ];
  
  if (isProduction) {
    parts.push('Secure');
  }
  
  return parts.join('; ');
}

/**
 * Create a Set-Cookie header to clear the session cookie.
 */
export function createClearSessionCookie(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    `Path=${SESSION_COOKIE_PATH}`,
    `SameSite=${SESSION_COOKIE_SAMESITE}`,
    'HttpOnly',
    'Max-Age=0',
  ];
  
  if (isProduction) {
    parts.push('Secure');
  }
  
  return parts.join('; ');
}

/**
 * Extract session ID from Astro request headers.
 */
export function getSessionIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }
  return getSessionIdFromCookie(cookieHeader);
}
