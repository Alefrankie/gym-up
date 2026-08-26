// src/lib/contexts/workout-tracking/infrastructure/supabase/supabase-photo.repository.ts
//
// Supabase-backed implementation of PhotoRepository (story 6.2, row-level).
//
// Per ADR-005: photos are private (owner-only). RLS enforces owner-only on
// progress_photos rows. The repo still performs a read-then-check so it can
// throw the typed `PhotoOwnershipError` on cross-user attempts (RLS alone
// would silently return 0 rows / undefined).
//
// Storage objects (bucket `progress-photos`, upload/signed URLs) land in
// story 6.3 — this repo only manages the DB row. `create` does NOT write a
// file (the SQLite impl wrote a placeholder to disk; Supabase storage is 6.3).
//
// Per ADR-007 + ADR-011: `implements`, not `extends`.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NewProgressPhoto, ProgressPhoto } from '@db/schema';
import {
  PhotoOwnershipError,
  PhotoRepository,
} from '@/lib/contexts/workout-tracking/domain/photo.repository';

interface ProgressPhotoRow {
  id: string;
  user_id: string;
  storage_path: string;
  photo_date: string; // DATE → 'YYYY-MM-DD'
  caption: string | null;
  created_at: string;
}

/** 'YYYY-MM-DD' key in UTC. */
function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Date at UTC midnight from a 'YYYY-MM-DD' key. */
function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function toProgressPhoto(row: ProgressPhotoRow): ProgressPhoto {
  return {
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path,
    photoDate: fromDateKey(row.photo_date),
    caption: row.caption,
    createdAt: new Date(row.created_at),
  };
}

export class SupabasePhotoRepository implements PhotoRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(
    id: string,
    currentUserId: string,
  ): Promise<ProgressPhoto | undefined> {
    const { data, error } = await this.supabase
      .from('progress_photos')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch photo ${id}: ${error.message}`);
    }
    if (!data) return undefined;
    const row = data as ProgressPhotoRow;
    if (row.user_id !== currentUserId) {
      // Per ADR-005: do not leak existence. Throw ownership error so the
      // caller can distinguish 404 from 403.
      throw new PhotoOwnershipError(id, currentUserId);
    }
    return toProgressPhoto(row);
  }

  async findByUser(userId: string): Promise<ProgressPhoto[]> {
    const { data, error } = await this.supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', userId)
      .order('photo_date', { ascending: false });
    if (error) {
      throw new Error(`Failed to fetch photos for user ${userId}: ${error.message}`);
    }
    return (data ?? []).map((row) => toProgressPhoto(row as ProgressPhotoRow));
  }

  async create(
    input: NewProgressPhoto,
    currentUserId: string,
  ): Promise<ProgressPhoto> {
    // Defense in depth: enforce that the row's userId matches the
    // authenticated caller, regardless of what `input` claims.
    if (input.userId && input.userId !== currentUserId) {
      throw new PhotoOwnershipError('(unsaved)', currentUserId);
    }

    const photoDateMs = input.photoDate
      ? new Date(input.photoDate).getTime()
      : Date.now();
    const storagePath =
      input.storagePath && input.storagePath.length > 0
        ? input.storagePath
        : `${currentUserId}/${photoDateMs}.jpg`;

    const { data, error } = await this.supabase
      .from('progress_photos')
      .insert({
        user_id: currentUserId,
        storage_path: storagePath,
        photo_date: toDateKey(new Date(photoDateMs)),
        ...(input.caption !== undefined && { caption: input.caption }),
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to create photo: ${error.message}`);
    }
    return toProgressPhoto(data as ProgressPhotoRow);
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    const existing = await this.findById(id, currentUserId);
    if (!existing) {
      throw new Error(`Progress photo not found: ${id}`);
    }

    const { error } = await this.supabase
      .from('progress_photos')
      .delete()
      .eq('id', id);
    if (error) {
      throw new Error(`Failed to delete photo ${id}: ${error.message}`);
    }
  }
}