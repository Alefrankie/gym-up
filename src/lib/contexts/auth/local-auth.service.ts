// src/lib/contexts/auth/local-auth.service.ts
//
// Local implementation of AuthService.
// Uses SQLite for session storage and argon2 for password hashing.

import { eq } from 'drizzle-orm';
import { profiles } from '@db/schema';
import { db as defaultDb, type Db } from '@/lib/db/client';
import type {
  AuthService,
  RegisterInput,
  LoginInput,
  Session,
  User,
  SessionRepository,
  PasswordHasher,
} from './auth.types';

/**
 * Local implementation of AuthService.
 * Uses SQLite sessions table + httpOnly cookie.
 * Password hash stored in profiles table.
 *
 * The `db` parameter allows injecting a test database (in-memory SQLite)
 * so unit tests don't pollute the production local.db.
 */
export class LocalAuthService implements AuthService {
  private sessionRepository: SessionRepository;
  private passwordHasher: PasswordHasher;
  private sessionDurationMs: number;
  private db: Db;

  constructor(
    sessionRepository: SessionRepository,
    passwordHasher: PasswordHasher,
    sessionDurationMs: number = 7 * 24 * 60 * 60 * 1000, // 7 days default
    db: Db = defaultDb,
  ) {
    this.sessionRepository = sessionRepository;
    this.passwordHasher = passwordHasher;
    this.sessionDurationMs = sessionDurationMs;
    this.db = db;
  }

  /**
   * Register a new user.
   * Validates input, hashes password, creates profiles row,
   * and starts a session.
   */
  async register(input: RegisterInput): Promise<Session> {
    // Check if user already exists
    const existingUser = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, input.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await this.passwordHasher.hash(input.password);

    // Create profiles row
    const userId = crypto.randomUUID();
    await this.db.insert(profiles).values({
      id: userId,
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      routineType: input.routineType,
      weightUnit: input.weightUnit,
    });

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.sessionDurationMs);
    await this.sessionRepository.create(sessionId, userId, expiresAt);

    // Return session with user data
    return {
      sessionId,
      user: {
        id: userId,
        email: input.email,
        displayName: input.displayName,
        routineType: input.routineType,
        weightUnit: input.weightUnit,
        createdAt: new Date(),
      },
      expiresAt,
    };
  }

  /**
   * Login an existing user.
   * Verifies password, creates session row, sets httpOnly cookie.
   */
  async login(input: LoginInput): Promise<Session> {
    // Find user by email
    const userResult = await this.db
      .select({
        id: profiles.id,
        email: profiles.email,
        passwordHash: profiles.passwordHash,
        displayName: profiles.displayName,
        routineType: profiles.routineType,
        weightUnit: profiles.weightUnit,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(eq(profiles.email, input.email))
      .limit(1);

    if (userResult.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = userResult[0];

    // Verify password
    const isValidPassword = await this.passwordHasher.verify(
      input.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.sessionDurationMs);
    await this.sessionRepository.create(sessionId, user.id, expiresAt);

    // Return session with user data
    return {
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        routineType: user.routineType as 'hombre' | 'mujer',
        weightUnit: user.weightUnit as 'kg' | 'lbs',
        createdAt: user.createdAt,
      },
      expiresAt,
    };
  }

  /**
   * Logout the current user.
   * Destroys session and clears cookie.
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessionRepository.delete(sessionId);
  }

  /**
   * Get the current user from the session cookie.
   * Returns null if no valid session exists.
   */
  async getCurrentUser(sessionId: string): Promise<User | null> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return null;
    }

    // Get user from profiles table
    const userResult = await this.db
      .select({
        id: profiles.id,
        email: profiles.email,
        displayName: profiles.displayName,
        routineType: profiles.routineType,
        weightUnit: profiles.weightUnit,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(eq(profiles.id, session.userId))
      .limit(1);

    if (userResult.length === 0) {
      return null;
    }

    const user = userResult[0];
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      routineType: user.routineType as 'hombre' | 'mujer',
      weightUnit: user.weightUnit as 'kg' | 'lbs',
      createdAt: user.createdAt,
    };
  }
}
