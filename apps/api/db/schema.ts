// db/schema.ts
//
// =============================================================
// SINGLE SOURCE OF TRUTH for the canonical tables.
// =============================================================
//
// This file is reused in Round 6 against Postgres per ADR-012.
// The Round 1 (SQLite) and Round 6 (Postgres) versions are
// kept structurally identical so the swap is mechanical:
//
//   1. Replace `sqliteTable` import with `pgTable`.
//   2. Replace `text` PK with `uuid` for tables that reference
//      Supabase `auth.users` (`profiles.id`).
//   3. Add `.references(() => <authTable>.id)` for FKs that
//      SQLite skipped in Round 1 (no local `auth.users`).
//   4. Replace `integer({ mode: 'timestamp' })` with `timestamp`.
//   5. Update `drizzle.config.ts` dialect flag and driver
//      import in `src/lib/db/client.ts`.
//
// Until then, RLS-equivalent guards live in the repository
// layer (SqliteXxxRepository) per ADR-004 / ADR-005 / ADR-007.
// =============================================================

import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, real, blob } from 'drizzle-orm/sqlite-core';

/**
 * User profile. Created on registration (Round 1: in LocalAuthService
 * transaction; Round 6: via a `handle_new_user()` trigger on auth.users).
 *
 * Round 1: `id` is generated client-side via crypto.randomUUID().
 * Round 6: `id` becomes `uuid('id').primaryKey().references(() => authUsers.id)`.
 */
export const profiles = sqliteTable('profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  routineType: text('routine_type', { enum: ['hombre', 'mujer'] }).notNull(),
  weightUnit: text('weight_unit', { enum: ['kg', 'lbs'] })
    .notNull()
    .default('kg'),
  /** For calorie estimates; null until set in Settings. */
  bodyWeightKg: real('body_weight_kg'),
  /** Coach personality for motivational lines and voice. */
  coachTone: text('coach_tone', { enum: ['flower', 'normal', 'hard', 'gymrat'] })
    .notNull()
    .default('normal'),
  /** How the coach addresses the user in Spanish (grammatical gender). */
  // The column's SQL default is still the old 'neutral' (SQLite cannot change it in place), so new rows get 'm'
  // from here; migration 0016 moved existing rows to 'm' or 'f'.
  addressForm: text('address_form', { enum: ['m', 'f'] })
    .notNull()
    .$defaultFn(() => 'm'),
  /** Whether the user picked the address form (Home asks once until they do). */
  addressFormChosen: integer('address_form_chosen', { mode: 'boolean' }).notNull().default(false),
  activeProgramId: text('active_program_id'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

/**
 * Exercise catalog (seed data per ADR-003).
 * Read-all (no userId): exercises are shared across all users.
 * `muscleGroup` enables filtering (chest, back, legs, etc.).
 */
export const exercises = sqliteTable('exercises', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  muscleGroup: text('muscle_group').notNull(),
  secondaryMuscles: text('secondary_muscles').notNull().default('[]'),
  equipment: text('equipment').notNull().default('other'),
  exerciseType: text('exercise_type').notNull().default('weight_reps'),
  instructions: text('instructions'),
  videoUrl: text('video_url'),
  /** NULL = system exercise; otherwise the profile that created it (ADR-017). */
  ownerId: text('owner_id'),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(0),
});

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

/**
 * Routine header (hombre / mujer). Seed data per ADR-003.
 * `type` mirrors profiles.routineType; routines are global, not per-user.
 */
export const routines = sqliteTable('routines', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', { enum: ['hombre', 'mujer', 'neutral'] }).notNull(),
  /** NULL = seeded template; otherwise the owner of the program (ADR-018). */
  ownerId: text('owner_id'),
  sourceTemplateId: text('source_template_id'),
  description: text('description'),
  isTemplate: integer('is_template', { mode: 'boolean' }).notNull().default(false),
  level: text('level'),
  goal: text('goal'),
  daysPerWeek: integer('days_per_week'),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
});

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;

/**
 * One day of a routine (e.g. "Monday — Chest + Shoulders + Triceps").
 * Cascade-delete with parent routine.
 * `dayNumber` 1-7, unique per routine.
 */
export const routineDays = sqliteTable('routine_days', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  routineId: text('routine_id')
    .notNull()
    .references(() => routines.id, { onDelete: 'cascade' }),
  dayNumber: integer('day_number').notNull(),
  dayName: text('day_name').notNull(),
  focus: text('focus').notNull(),
  notes: text('notes'),
  /** Planned day of the week, 0 = Sunday … 6 = Saturday; null = no fixed day (rotation). */
  weekday: integer('weekday'),
});

export type RoutineDay = typeof routineDays.$inferSelect;
export type NewRoutineDay = typeof routineDays.$inferInsert;

/**
 * Exercise slot inside a routine day (target sets/reps/order).
 * Cascade-delete with parent routine_day.
 */
export const routineExercises = sqliteTable('routine_exercises', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  routineDayId: text('routine_day_id')
    .notNull()
    .references(() => routineDays.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  targetSets: integer('target_sets').notNull().default(4),
  targetReps: integer('target_reps').notNull().default(10),
  exerciseOrder: integer('exercise_order').notNull(),
  targetRepsMin: integer('target_reps_min'),
  targetRepsMax: integer('target_reps_max'),
  warmupSets: integer('warmup_sets').notNull().default(0),
  restSeconds: integer('rest_seconds'),
  notes: text('notes'),
  /** JSON [{ reps, type }] per set; null means targetSets normal sets of targetReps. */
  setPlan: text('set_plan', { mode: 'json' }).$type<{ reps: number; type: 'normal' | 'warmup' | 'drop' | 'failure'; weight?: number }[]>(),
});

export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;

/**
 * A workout session: user + routine_day + date.
 * `workoutDate` stored as ms-since-epoch (DATE in Postgres Round 6).
 * `status`: 'in_progress' | 'completed'.
 * Visibility: write-own (userId), read-all (ADR-004).
 */
export const workouts = sqliteTable('workouts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  routineDayId: text('routine_day_id')
    .notNull()
    .references(() => routineDays.id),
  workoutDate: integer('workout_date', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  status: text('status', { enum: ['in_progress', 'completed'] })
    .notNull()
    .default('in_progress'),
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

/**
 * A single set logged inside a workout.
 * Cascade-delete with parent workout.
 * `weight` is stored in KG per ADR-006 (display conversion at UI).
 */
export const workoutEntries = sqliteTable('workout_entries', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workoutId: text('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps').notNull(),
  weight: integer('weight').notNull().default(0),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  /** normal | warmup | drop | failure. Warm-up sets do not count toward volume. */
  setType: text('set_type', { enum: ['normal', 'warmup', 'drop', 'failure'] }).notNull().default('normal'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type WorkoutEntry = typeof workoutEntries.$inferSelect;
export type NewWorkoutEntry = typeof workoutEntries.$inferInsert;

/**
 * Progress photo metadata. Owner-only per ADR-005.
 * `storagePath` is the relative path to the file on local filesystem
 * (Round 6 swaps to Supabase Storage).
 * Round 1: `./uploads/photos/{user_id}/{timestamp}.jpg`.
 */
export const progressPhotos = sqliteTable('progress_photos', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  photoDate: integer('photo_date', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  caption: text('caption'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type NewProgressPhoto = typeof progressPhotos.$inferInsert;

/**
 * User session. Stores session data for authentication.
 * Round 1: SQLite sessions table with httpOnly cookie.
 * Round 6: Supabase Auth handles sessions.
 */
export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' })
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

/**
 * Nutrition entry. Stores one analyzed meal with photo reference and macro breakdown.
 * Owner-only per ADR-005.
 *
 * Round 1: SQLite with local filesystem photo storage.
 * Round 6: Postgres + Supabase Storage.
 */
export const nutritionEntries = sqliteTable('nutrition_entries', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  photoDate: integer('photo_date', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  totalCalories: integer('total_calories').notNull().default(0),
  totalProtein: integer('total_protein').notNull().default(0),
  totalCarbs: integer('total_carbs').notNull().default(0),
  totalFat: integer('total_fat').notNull().default(0),
  /** JSON-serialized FoodItem[] array. Read with JSON.parse, write with JSON.stringify. */
  foodItems: text('food_items').notNull(),
  /** JSON-serialized raw AI provider response. null when not provided. */
  aiRawResponse: text('ai_raw_response'),
  userEdited: integer('user_edited', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type NutritionEntry = typeof nutritionEntries.$inferSelect;
export type NewNutritionEntry = typeof nutritionEntries.$inferInsert;

/**
 * Nutrition goal. One-to-one with profiles (PK = user_id).
 * Stores the user's daily calorie target.
 * null goal means unset (no progress bar shown).
 */
export const nutritionGoals = sqliteTable('nutrition_goals', {
  userId: text('user_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  dailyCalorieGoal: integer('daily_calorie_goal'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type NutritionGoal = typeof nutritionGoals.$inferSelect;
export type NewNutritionGoal = typeof nutritionGoals.$inferInsert;

/** A group of friends: members see each other's workout summaries, nobody else does. */
export const groups = sqliteTable('groups', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  /** Invite code shared out of band; unique. */
  code: text('code').notNull().unique(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull().default(0),
});

export const groupMembers = sqliteTable(
  'group_members',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    joinedAt: integer('joined_at').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

export type Group = typeof groups.$inferSelect;

/** Daily supplements a user wants to tick off (creatine, pre-workout, protein…). Archived ones keep their log. */
export const supplements = sqliteTable('supplements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(0),
});

/** One row per supplement taken on a calendar day (the user's local `YYYY-MM-DD`). */
export const supplementLogs = sqliteTable(
  'supplement_logs',
  {
    supplementId: text('supplement_id')
      .notNull()
      .references(() => supplements.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    takenAt: integer('taken_at').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.supplementId, t.day] })],
);

export type Supplement = typeof supplements.$inferSelect;

/** Shared feedback board visible to every authenticated Gym Up account. */
export const feedbackItems = sqliteTable('feedback_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  category: text('category', { enum: ['idea', 'bug', 'other'] }).notNull().default('idea'),
  status: text('status', { enum: ['open', 'planned', 'in_progress', 'resolved'] }).notNull().default('open'),
  authorId: text('author_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  authorName: text('author_name').notNull(),
  createdAt: integer('created_at').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
});

export type FeedbackItem = typeof feedbackItems.$inferSelect;

/** Characters sent to the Coach cloud voice per UTC day (Workers AI free allocation guard). */
export const coachVoiceUsage = sqliteTable('coach_voice_usage', {
  day: text('day').primaryKey(),
  chars: integer('chars').notNull().default(0),
});

/**
 * The Coach's lines recorded by an admin in the voice studio. `id` is the hash of the voice slot and the rendered
 * line, so the app finds a recording from the line it is about to say. Audio is stored inline (small Opus clips).
 */
export const coachRecordings = sqliteTable('coach_recordings', {
  id: text('id').primaryKey(),
  tone: text('tone').notNull(),
  locale: text('locale').notNull(),
  event: text('event').notNull(),
  form: text('form'),
  text: text('text').notNull(),
  contentType: text('content_type').notNull(),
  audio: blob('audio', { mode: 'buffer' }).notNull(),
  bytes: integer('bytes').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** People the admin let into the voice studio (besides the admin). */
export const studioMembers = sqliteTable('studio_members', {
  userId: text('user_id').primaryKey(),
  grantedBy: text('granted_by').notNull(),
  createdAt: integer('created_at').notNull(),
});

/** One take per person per line of the voice studio. `lineId` = hash of the voice slot and the rendered line. */
export const studioTakes = sqliteTable('studio_takes', {
  id: text('id').primaryKey(),
  lineId: text('line_id').notNull(),
  authorId: text('author_id').notNull(),
  tone: text('tone').notNull(),
  locale: text('locale').notNull(),
  event: text('event').notNull(),
  form: text('form'),
  text: text('text').notNull(),
  contentType: text('content_type').notNull(),
  audio: blob('audio', { mode: 'buffer' }).notNull(),
  bytes: integer('bytes').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** The take the app plays for a line, picked by the admin. */
export const studioActive = sqliteTable('studio_active', {
  lineId: text('line_id').primaryKey(),
  takeId: text('take_id').notNull(),
  chosenBy: text('chosen_by').notNull(),
  chosenAt: integer('chosen_at').notNull(),
});

export const studioVotes = sqliteTable(
  'studio_votes',
  {
    takeId: text('take_id').notNull(),
    userId: text('user_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.takeId, t.userId] })],
);

/** Opinions on a line (optionally about one take). */
export const studioComments = sqliteTable('studio_comments', {
  id: text('id').primaryKey(),
  lineId: text('line_id').notNull(),
  takeId: text('take_id'),
  authorId: text('author_id').notNull(),
  text: text('text').notNull(),
  createdAt: integer('created_at').notNull(),
});

/** Writes and uploaded bytes per person per UTC day (free-tier guard). */
export const studioUsage = sqliteTable(
  'studio_usage',
  {
    userId: text('user_id').notNull(),
    day: text('day').notNull(),
    writes: integer('writes').notNull().default(0),
    bytes: integer('bytes').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);
