// src/lib/contexts/workout-tracking/infrastructure/supabase/supabase-profile.repository.ts
//
// Supabase-backed implementation of ProfileRepository (story 6.2).
//
// Per ADR-004: read-all on display_name; write-own on routine_type/weight_unit
// (RLS enforces the write-own; the repo does not inject userId filters).
// Per ADR-007 + ADR-011: `implements`, not `extends`.
//
// NOTE on email/passwordHash: `public.profiles` in Postgres has NO
// email/password_hash columns — those live in `auth.users` (Round 6).
// The `Profile` type from `@db/schema` (SQLite) still declares them, so
// this repo maps them to placeholders ('' / '') and documents that they
// are only meaningful for the SQLite local-auth path (story 6.3 swaps
// auth to Supabase Auth, which never reads these fields).
// `findByEmail` resolves the profile via the `get_profile_by_email` RPC
// (SECURITY DEFINER) against `auth.users`.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, NewProfile } from '@db/schema';
import { ProfileRepository } from '@/lib/contexts/workout-tracking/domain/profile.repository';

/** Raw Postgres row shape for `public.profiles`. */
interface ProfileRow {
  id: string;
  display_name: string;
  routine_type: 'hombre' | 'mujer';
  weight_unit: 'kg' | 'lbs';
  created_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    // Placeholders — no email/password_hash columns in Postgres (see header).
    email: '',
    passwordHash: '',
    displayName: row.display_name,
    routineType: row.routine_type,
    weightUnit: row.weight_unit,
    createdAt: new Date(row.created_at),
  };
}

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<Profile | undefined> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, display_name, routine_type, weight_unit, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch profile ${id}: ${error.message}`);
    }
    if (!data) return undefined;
    return toProfile(data as ProfileRow);
  }

  async findByEmail(email: string): Promise<Profile | undefined> {
    const { data, error } = await this.supabase.rpc('get_profile_by_email', {
      target_email: email,
    });
    if (error) {
      throw new Error(`Failed to fetch profile by email: ${error.message}`);
    }
    const row = (data ?? [])[0] as ProfileRow | undefined;
    if (!row) return undefined;
    return {
      ...toProfile(row),
      // The email is known (it was the query argument) — fill it in.
      email,
    };
  }

  async create(input: NewProfile): Promise<Profile> {
    // In production, profiles are created by the `handle_new_user()` trigger
    // when a user signs up via auth.users. This method exists to satisfy the
    // contract; it inserts directly into public.profiles (email/passwordHash
    // are ignored — no such columns in Postgres). Fails with a clear error if
    // the id does not exist in auth.users (FK violation).
    const { data, error } = await this.supabase
      .from('profiles')
      .insert({
        id: input.id,
        display_name: input.displayName,
        routine_type: input.routineType,
        weight_unit: input.weightUnit,
      })
      .select('id, display_name, routine_type, weight_unit, created_at')
      .single();
    if (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }
    return toProfile(data as ProfileRow);
  }

  async update(
    id: string,
    patch: Partial<Pick<Profile, 'displayName' | 'routineType' | 'weightUnit'>>,
  ): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({
        ...(patch.displayName !== undefined && { display_name: patch.displayName }),
        ...(patch.routineType !== undefined && { routine_type: patch.routineType }),
        ...(patch.weightUnit !== undefined && { weight_unit: patch.weightUnit }),
      })
      .eq('id', id)
      .select('id, display_name, routine_type, weight_unit, created_at')
      .single();
    if (error) {
      throw new Error(`Failed to update profile ${id}: ${error.message}`);
    }
    return toProfile(data as ProfileRow);
  }
}