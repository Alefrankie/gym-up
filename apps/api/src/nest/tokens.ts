// Injection tokens. Constructor injection always uses an explicit @Inject(token)
// so the code does not depend on emitted decorator metadata (ADR-027 spike).

export const DB = Symbol('DB');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const AUTH_SERVICE = Symbol('AUTH_SERVICE');
export const RATE_LIMITER = Symbol('RATE_LIMITER');
export const PHOTO_STORAGE = Symbol('PHOTO_STORAGE');
export const AI_PORT = Symbol('AI_PORT');
export const AI_ANALYSIS = Symbol('AI_ANALYSIS');
export const COACH_SPEECH = Symbol('COACH_SPEECH');

/** Minimal rate limiter port; the Worker adapts Cloudflare's Rate Limiting binding to it. */
export interface RateLimiter {
  /** Resolves `true` when the call is allowed, `false` when the key is over its limit. */
  allow(key: string): Promise<boolean>;
}
