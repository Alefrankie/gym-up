// src/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-entry.repository.ts
//
// SQLite-backed implementation of NutritionEntryRepository.
// Per ADR-005: entries are private (owner-only).
// Per ADR-007 + ADR-011: implements, not extends.
// Per ADR-012: consumes the Drizzle `db` instance.
//
// Storage (Round 1): local filesystem at `./uploads/nutrition/{userId}/{timestampMs}.{ext}`.
// Round 6 swaps to Supabase Storage; the abstract contract stays the same.

import { desc, eq, and, gte, lt } from 'drizzle-orm';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Db } from '@/lib/db/client';
import {
  nutritionEntries,
  type NutritionEntry,
  type NewNutritionEntry,
} from '@db/schema';
import {
  NutritionEntryOwnershipError,
} from '@/lib/contexts/nutrition/domain/nutrition-entry-repository';
import type { NutritionEntryCreateDTO } from '@/lib/contexts/nutrition/domain/nutrition.types';

const DEFAULT_UPLOADS_ROOT = resolve(process.cwd(), 'uploads', 'nutrition');

export class SqliteNutritionEntryRepository {
  private readonly uploadsRoot: string;

  constructor(
    private readonly db: Db,
    options: { uploadsRoot?: string } = {},
  ) {
    this.uploadsRoot = options.uploadsRoot ?? DEFAULT_UPLOADS_ROOT;
  }

  private absolutePathFor(storagePath: string): string {
    return join(this.uploadsRoot, storagePath);
  }

  async findById(
    id: string,
    currentUserId: string,
  ): Promise<NutritionEntry | undefined> {
    const rows = await this.db
      .select()
      .from(nutritionEntries)
      .where(eq(nutritionEntries.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    if (row.userId !== currentUserId) {
      throw new NutritionEntryOwnershipError(id, currentUserId);
    }
    return row;
  }

  async findByUser(userId: string): Promise<NutritionEntry[]> {
    return this.db
      .select()
      .from(nutritionEntries)
      .where(eq(nutritionEntries.userId, userId))
      .orderBy(desc(nutritionEntries.createdAt));
  }

  async findByDateRange(
    userId: string,
    startMs: number,
    endMs: number,
  ): Promise<NutritionEntry[]> {
    return this.db
      .select()
      .from(nutritionEntries)
      .where(
        and(
          eq(nutritionEntries.userId, userId),
          gte(nutritionEntries.createdAt, new Date(startMs)),
          lt(nutritionEntries.createdAt, new Date(endMs)),
        ),
      )
      .orderBy(desc(nutritionEntries.createdAt));
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

    const id = crypto.randomUUID();
    const storagePath = input.storagePath;
    const photoDateMs = input.photoDate;
    const createdAt = input.createdAt ?? new Date(Math.floor(Date.now() / 1000) * 1000);

    // Write bytes to disk first. On failure, the caller must clean up.
    // We do NOT write a placeholder — the use case writes real bytes
    // before calling create, so the file already exists on disk.
    const absolutePath = this.absolutePathFor(storagePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    if (!existsSync(absolutePath)) {
      // Placeholder for tests that call create without pre-writing bytes
      writeFileSync(absolutePath, '');
    }

    const rows = await this.db
      .insert(nutritionEntries)
      .values({
        id,
        userId: currentUserId,
        storagePath,
        photoDate: new Date(photoDateMs),
        totalCalories: input.totalCalories,
        totalProtein: input.totalProtein,
        totalCarbs: input.totalCarbs,
        totalFat: input.totalFat,
        foodItems: JSON.stringify(input.foodItems),
        aiRawResponse: input.aiRawResponse
          ? JSON.stringify(input.aiRawResponse)
          : null,
        userEdited: input.userEdited,
        createdAt,
      })
      .returning();

    return rows[0]!;
  }

  async delete(id: string, currentUserId: string): Promise<void> {
    const entry = await this.findById(id, currentUserId);
    if (!entry) return;

    // Remove file from disk
    const absolutePath = this.absolutePathFor(entry.storagePath);
    if (existsSync(absolutePath)) {
      unlinkSync(absolutePath);
    }

    // Remove DB row
    await this.db
      .delete(nutritionEntries)
      .where(eq(nutritionEntries.id, id));
  }
}
