// src/lib/contexts/auth/auth.composition.ts
//
// Auth context composition root.
// Wires up dependencies for the auth context.

import { SqliteSessionRepository } from './sqlite-session.repository';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { LocalAuthService } from './local-auth.service';
import type { AuthService } from './auth.types';

// Session duration: 7 days
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Create an AuthService instance.
 * This is the composition root for the auth context.
 */
export function createAuthService(): AuthService {
  const sessionRepository = new SqliteSessionRepository();
  const passwordHasher = new Argon2PasswordHasher();
  
  return new LocalAuthService(
    sessionRepository,
    passwordHasher,
    SESSION_DURATION_MS
  );
}

// Singleton instance for the application
let authServiceInstance: AuthService | null = null;

/**
 * Get the AuthService singleton instance.
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = createAuthService();
  }
  return authServiceInstance;
}
