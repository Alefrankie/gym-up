// src/lib/contexts/public-view/infrastructure/supabase/supabase-public-profile.repository.ts
//
// Supabase-backed implementation of PublicProfileRepository (story 6.2).
// Per ADR-004: read-all — no ownership guard (RLS allows read-all).
// Per golden-rules (Cross-Context Isolation): reads directly from the
// profiles table, NOT via ProfileRepository from auth context.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type PublicProfileRepository,
  type PublicProfileRow,
} from '../../domain/public-profile.repository';

interface PublicProfileRowRaw {
  id: string;
  display_name: string;
  routine_type: 'hombre' | 'mujer';
}

export class SupabasePublicProfileRepository implements PublicProfileRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getAll(): Promise<PublicProfileRow[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, display_name, routine_type');
    if (error) {
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }
    return (data ?? []).map((row) => {
      const r = row as PublicProfileRowRaw;
      return { id: r.id, displayName: r.display_name, routineType: r.routine_type };
    });
  }

  async getById(id: string): Promise<PublicProfileRow | undefined> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, display_name, routine_type')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch profile ${id}: ${error.message}`);
    }
    if (!data) return undefined;
    const r = data as PublicProfileRowRaw;
    return { id: r.id, displayName: r.display_name, routineType: r.routine_type };
  }
}