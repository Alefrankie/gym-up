// tests/auth/local-auth.service.test.ts
//
// Tests for LocalAuthService.
// Tests registration, login, logout, and getCurrentUser.
//
// IMPORTANT: LocalAuthService accepts an injected db parameter.
// Tests use an in-memory SQLite database to avoid polluting local.db.

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { LocalAuthService } from '../../src/lib/contexts/auth/local-auth.service';
import type { SessionRepository, PasswordHasher } from '../../src/lib/contexts/auth/auth.types';
import * as schema from '@db/schema';

// ---------- In-memory test DB ----------
const DDL = `
  CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    routine_type TEXT NOT NULL,
    weight_unit TEXT NOT NULL DEFAULT 'kg',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`;

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema }) as BetterSQLite3Database<typeof schema>;
  return { db, sqlite };
}

// Mock implementations
const mockSessionRepository: SessionRepository = {
  create: async () => {},
  findById: async () => undefined,
  delete: async () => {},
  deleteByUserId: async () => {},
};

const mockPasswordHasher: PasswordHasher = {
  hash: async (password: string) => `hashed_${password}`,
  verify: async (password: string, hash: string) => hash === `hashed_${password}`,
};

describe('LocalAuthService', () => {
  let authService: LocalAuthService;
  let testDb: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    testDb = createTestDb();
    authService = new LocalAuthService(
      mockSessionRepository,
      mockPasswordHasher,
      7 * 24 * 60 * 60 * 1000, // 7 days
      testDb.db, // inject in-memory DB instead of production local.db
    );
  });

  afterAll(() => {
    testDb?.sqlite.close();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const timestamp = Date.now();
      const input = {
        email: `test${timestamp}@example.com`,
        password: 'password123',
        displayName: 'Test User',
        routineType: 'hombre' as const,
        weightUnit: 'kg' as const,
      };

      const session = await authService.register(input);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.user.email).toBe(input.email);
      expect(session.user.displayName).toBe(input.displayName);
      expect(session.user.routineType).toBe(input.routineType);
      expect(session.user.weightUnit).toBe(input.weightUnit);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate email', async () => {
      const timestamp = Date.now();
      const input = {
        email: `duplicate${timestamp}@example.com`,
        password: 'password123',
        displayName: 'Test User',
        routineType: 'hombre' as const,
        weightUnit: 'kg' as const,
      };

      // First registration should succeed
      await authService.register(input);

      // Second registration with same email should fail
      await expect(authService.register(input)).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login an existing user successfully', async () => {
      const timestamp = Date.now();
      const registerInput = {
        email: `login${timestamp}@example.com`,
        password: 'password123',
        displayName: 'Test User',
        routineType: 'hombre' as const,
        weightUnit: 'kg' as const,
      };

      // Register user first
      await authService.register(registerInput);

      // Login should succeed
      const loginInput = {
        email: registerInput.email,
        password: 'password123',
      };

      const session = await authService.login(loginInput);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.user.email).toBe(loginInput.email);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw error for invalid credentials', async () => {
      const loginInput = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      };

      await expect(authService.login(loginInput)).rejects.toThrow('Invalid email or password');
    });
  });

  describe('getCurrentUser', () => {
    it('should return null for invalid session', async () => {
      const user = await authService.getCurrentUser('invalid-session-id');
      expect(user).toBeNull();
    });
  });
});
