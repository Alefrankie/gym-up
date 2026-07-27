// src/lib/contexts/auth/auth.types.ts
//
// Auth context types and interfaces.
// This file defines the AuthService interface that will be used
// in both Round 1 (LocalAuthService) and Round 6 (SupabaseAuthService).

import type { Profile } from '@db/schema';

/**
 * User representation returned by AuthService.
 * Extends Profile with authentication-specific fields.
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  routineType: 'hombre' | 'mujer';
  weightUnit: 'kg' | 'lbs';
  createdAt: Date;
}

/**
 * Session representation returned by AuthService.
 * Contains session ID and user information.
 */
export interface Session {
  sessionId: string;
  user: User;
  expiresAt: Date;
}

/**
 * Input for user registration.
 */
export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  routineType: 'hombre' | 'mujer';
  weightUnit: 'kg' | 'lbs';
}

/**
 * Input for user login.
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * AuthService interface.
 * This is the only auth surface used by UI/SSR code.
 * Swapping to SupabaseAuthService in Round 6 requires no UI change.
 */
export interface AuthService {
  /**
   * Register a new user.
   * Validates input, hashes password, creates profiles row,
   * and starts a session.
   */
  register(input: RegisterInput): Promise<Session>;

  /**
   * Login an existing user.
   * Verifies password, creates session row, sets httpOnly cookie.
   */
  login(input: LoginInput): Promise<Session>;

  /**
   * Logout the current user.
   * Destroys session and clears cookie.
   */
  logout(sessionId: string): Promise<void>;

  /**
   * Get the current user from the session cookie.
   * Returns null if no valid session exists.
   */
  getCurrentUser(sessionId: string): Promise<User | null>;
}

/**
 * Session repository interface.
 * Handles session storage operations.
 */
export interface SessionRepository {
  /**
   * Create a new session.
   */
  create(sessionId: string, userId: string, expiresAt: Date): Promise<void>;

  /**
   * Find a session by ID.
   */
  findById(sessionId: string): Promise<{ userId: string; expiresAt: Date } | undefined>;

  /**
   * Delete a session by ID.
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Delete all sessions for a user.
   */
  deleteByUserId(userId: string): Promise<void>;
}

/**
 * Password hasher interface.
 * Handles password hashing and verification.
 */
export interface PasswordHasher {
  /**
   * Hash a password.
   */
  hash(password: string): Promise<string>;

  /**
   * Verify a password against a hash.
   */
  verify(password: string, hash: string): Promise<boolean>;
}
