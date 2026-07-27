// src/lib/contexts/auth/argon2-password-hasher.ts
//
// Argon2 implementation of PasswordHasher.
// Uses argon2id for secure password hashing.

import argon2 from 'argon2';
import type { PasswordHasher } from './auth.types';

/**
 * Argon2 implementation of PasswordHasher.
 * Uses argon2id algorithm with secure defaults.
 */
export class Argon2PasswordHasher implements PasswordHasher {
  /**
   * Hash a password using argon2id.
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify a password against a hash.
   */
  async verify(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
