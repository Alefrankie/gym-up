// src/lib/contexts/auth/local-auth.service.ts
//
// Local implementation of AuthService.
// Uses SQLite for session storage and argon2 for password hashing.

import { eq, sql } from 'drizzle-orm';
import { profiles } from '@db/schema';
import type { Db } from '@/lib/db/client';

function normalizeEmail(email: string): string {
  // The request schema uses Zod's ASCII email format, and SQLite/D1 lower() is
  // ASCII-only. Keep the application-side normalization aligned with the database.
  return email.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}
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
    sessionDurationMs: number,
    db: Db,
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
    const email = normalizeEmail(input.email);

    // Check if user already exists
    const existingUser = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(sql`lower(${profiles.email}) = ${email}`);

    if (existingUser.length > 0) {
      throw new EmailAlreadyRegisteredError();
    }

    // Hash password
    const passwordHash = await this.passwordHasher.hash(input.password);

    // Create profiles row
    const userId = crypto.randomUUID();
    await this.db.insert(profiles).values({
      id: userId,
      email,
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
        email,
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
    const email = normalizeEmail(input.email);

    // Find user by email
    const userResult = await this.db
      .select({
        id: profiles.id,
        email: profiles.email,
        passwordHash: profiles.passwordHash,
        displayName: profiles.displayName,
        routineType: profiles.routineType,
        weightUnit: profiles.weightUnit,
        bodyWeightKg: profiles.bodyWeightKg,
        coachTone: profiles.coachTone,
        addressForm: profiles.addressForm,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(sql`lower(${profiles.email}) = ${email}`);

    if (userResult.length === 0) {
      throw new InvalidCredentialsError();
    }

    // Legacy registrations may have the same email stored with different casing.
    // Prefer an exact-casing match if present, then check other case-insensitive matches.
    const exactEmail = input.email.trim();
    const candidates = [
      ...userResult.filter((candidate) => candidate.email === exactEmail),
      ...userResult.filter((candidate) => candidate.email !== exactEmail),
    ];
    let user: (typeof userResult)[number] | undefined;
    for (const candidate of candidates) {
      if (await this.passwordHasher.verify(input.password, candidate.passwordHash)) {
        user = candidate;
        break;
      }
    }

    if (!user) {
      throw new InvalidCredentialsError();
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
        bodyWeightKg: user.bodyWeightKg,
        coachTone: user.coachTone,
        addressForm: user.addressForm,
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
        bodyWeightKg: profiles.bodyWeightKg,
        coachTone: profiles.coachTone,
        addressForm: profiles.addressForm,
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
      bodyWeightKg: user.bodyWeightKg,
      coachTone: user.coachTone,
      addressForm: user.addressForm,
      createdAt: user.createdAt,
    };
  }
}
