// src/lib/contexts/nutrition/infrastructure/supabase/supabase-nutrition-entry.repository.ts
//
// Supabase-backed implementation of NutritionEntryRepository (story 6.2).
// Per ADR-005: entries are private (owner-only). RLS enforces owner-only;
// the repo still read-then-checks to throw the typed
// `NutritionEntryOwnershipError` on cross-user attempts.
// Per ADR-007 + ADR-011: `implements`, not `extends`.
//
// Storage (Round 6): Supabase Storage lands with the photo flow; this repo
// only manages the DB row. `create` does NOT write a file (the SQLite impl
// wrote to local disk).

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  NutritionEntryOwnershipError,
} from '@/lib/contexts/nutrition/domain/nutrition-entry-repository';
import type {
  NutritionEntry,
  NutritionEntryCreateDTO,
} from '@/lib/contexts/nutrition/domain/nutrition.types';

interface NutritionEntryRow {
  id: string;
  user_id: string;
  storage_path: string;
  photo_date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  food_items: string;
  ai_raw_response: string | null;
  user_edited: boolean;
  created_at: string;
}

function toNutritionEntry(row: NutritionEntryRow): NutritionEntry {
  return {
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path,
    photoDate: new Date(row.photo_date),
    totalCalories: row.total_calories,
    totalProtein: row.total_protein,
    totalCarbs: row.total_carbs,
    totalFat: row.total_fat,
    foodItems: row.food_items,
    aiRawResponse: row.ai_raw_response,
    userEdited: row.user_edited,
    createdAt: new Date(row.created_at),
  };
}

export class SupabaseNutritionEntryRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(
    id: string,
    currentUserId: string,
  ): Promise<NutritionEntry | undefined> {
    const { data, error } = await this.supabase
      .from('nutrition_entries')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to fetch nutrition entry ${id}: ${error.message}`);
    }
    if (!data) return undefined;
    const row = data as NutritionEntryRow;
    if (row.user_id !== currentUserId) {
      throw new NutritionEntryOwnershipError(id, currentUserId);
    }
    return toNutritionEntry(row);
  }

  async findByUser(userId: string): Promise<NutritionEntry[]> {
    const { data, error } = await this.supabase
      .from('nutrition_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to fetch nutrition entries: ${error.message}`);
    }
    return (data ?? []).map((row) => toNutritionEntry(row as NutritionEntryRow));
  }

  async findByDateRange(
    userId: string,
    startMs: number,
    endMs: number,
  ): Promise<NutritionEntry[]> {
    const { data, error } = await this.supabase
      .from('nutrition_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(startMs).toISOString())
      .lt('created_at', new Date(endMs).toISOString())
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(`Failed to fetch nutrition entries by range: ${error.message}`);
    }
    return (data ?? []).map((row) => toNutritionEntry(row as NutritionEntryRow));
  }

  async create(
    input: NutritionEntryCreateDTO,
    currentUserId: string,
  ): Promise<NutritionEntry> {
    // Defense in depth: enforce that the row's userId matches
    // the authenticated caller.
    if (input.userId !== currentUserId) {
      throw new NutritionEntryOwnershipError('(unsaved)', currentUserId);
    }

    const { data, error } = await this.supabase
      .from('nutrition_entries')
      .insert({
        user_id: currentUserId,
        storage_path: input.storagePath,
        photo_date: new Date(input.photoDate).toISOString(),
        total_calories: input.totalCalories,
        total_protein: input.totalProtein,
        total_carbs: input.totalCarbs,
        total_fat: input.totalFat,
        food_items: JSON.stringify(input.foodItems),
        ai_raw_response: input.aiRawResponse
          ? JSON.stringify(input.aiRawResponse)
          : null,
        user_edited: input.userEdited,
        created_at: (input.createdAt ?? new Date()).toISOString(),
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(`Failed to create nutrition entry: ${error.message}`);
    }
    return toNutritionEntry(data as NutritionEntryRow);
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    const entry = await this.findById(id, currentUserId);
    if (!entry) return;

    const { error } = await this.supabase
      .from('nutrition_entries')
      .delete()
      .eq('id', id);
    if (error) {
      throw new Error(`Failed to delete nutrition entry ${id}: ${error.message}`);
    }
  }
}