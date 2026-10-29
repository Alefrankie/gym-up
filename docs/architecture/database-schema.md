# Database Schema

Parent: [./readme.md](./readme.md) · Up: [../README.md](../README.md)

## Decisions

- Routines as seed data: [ADR-003](./decisions/003-routines-seed-data.md)
- RLS model: [ADR-004](./decisions/004-rls-visibility.md)
- Private photos: [ADR-005](./decisions/005-private-photos.md)
- kg storage: [ADR-006](./decisions/006-kg-storage.md)
- **Phase 2:** workout model v2 [ADR-016](./decisions/016-workout-data-model-v2.md), exercise catalog [ADR-017](./decisions/017-exercise-catalog.md), user-owned programs [ADR-018](./decisions/018-user-owned-programs.md) (supersedes ADR-003), progression [ADR-021](./decisions/021-progression-engine.md), readiness [ADR-022](./decisions/022-readiness-and-recovery.md), body metrics [ADR-023](./decisions/023-body-metrics-privacy.md), social [ADR-024](./decisions/024-social-interactions.md), offline sync [ADR-025](./decisions/025-offline-live-workout.md), AI summary [ADR-026](./decisions/026-weekly-ai-coach-summary.md) → [Phase 2 Migrations](#phase-2-migrations)

> Phase 1 sections below describe migrations `001`–`003` as shipped. Phase 2 changes are **additive migrations** `004`–`011`; when a Phase 1 statement conflicts with a Phase 2 migration (e.g. `workouts` unique constraint, `exercises.name UNIQUE`, routine RLS), the Phase 2 migration wins.

## Migration: `001_initial_schema.sql`

### Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Tables

#### `profiles`

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  routine_type TEXT NOT NULL CHECK (routine_type IN ('hombre', 'mujer')),
  weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lbs')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, routine_type, weight_unit)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'routine_type', 'hombre'),
    COALESCE(NEW.raw_user_meta_data->>'weight_unit', 'kg')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

#### `exercises`

```sql
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  muscle_group TEXT NOT NULL
);
CREATE INDEX idx_exercises_muscle_group ON exercises(muscle_group);
```

#### `routines`

```sql
CREATE TABLE routines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hombre', 'mujer'))
);
```

#### `routine_days`

```sql
CREATE TABLE routine_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  day_name TEXT NOT NULL,
  focus TEXT NOT NULL,
  UNIQUE(routine_id, day_number)
);
CREATE INDEX idx_routine_days_routine ON routine_days(routine_id);
```

#### `routine_exercises`

```sql
CREATE TABLE routine_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_day_id UUID NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  target_sets INT NOT NULL DEFAULT 4,
  target_reps INT NOT NULL DEFAULT 10,
  exercise_order INT NOT NULL,
  UNIQUE(routine_day_id, exercise_order)
);
CREATE INDEX idx_routine_exercises_day ON routine_exercises(routine_day_id);
```

#### `workouts`

```sql
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  routine_day_id UUID NOT NULL REFERENCES routine_days(id),
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, workout_date, routine_day_id)
);
CREATE INDEX idx_workouts_user_date ON workouts(user_id, workout_date DESC);
CREATE INDEX idx_workouts_status ON workouts(user_id, status);
```

#### `workout_entries`

```sql
CREATE TABLE workout_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number INT NOT NULL,
  reps INT NOT NULL,
  weight DECIMAL(6,2) NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_entries_workout ON workout_entries(workout_id);
CREATE INDEX idx_entries_exercise ON workout_entries(exercise_id);
```

#### `progress_photos`

```sql
CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  photo_date DATE NOT NULL DEFAULT CURRENT_DATE,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_photos_user ON progress_photos(user_id, photo_date DESC);
```

#### `nutrition_entries` (story 6.2 — migración `002_nutrition_and_rls.sql`)

```sql
CREATE TABLE nutrition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  photo_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_calories INT NOT NULL DEFAULT 0,
  total_protein INT NOT NULL DEFAULT 0,
  total_carbs INT NOT NULL DEFAULT 0,
  total_fat INT NOT NULL DEFAULT 0,
  food_items TEXT NOT NULL DEFAULT '[]',
  ai_raw_response TEXT,
  user_edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_nutrition_entries_user ON nutrition_entries(user_id, created_at DESC);
```

#### `nutrition_goals` (story 6.2 — migración `002_nutrition_and_rls.sql`)

```sql
CREATE TABLE nutrition_goals (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  daily_calorie_goal INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Seed Data

#### Exercises

```sql
INSERT INTO exercises (name, muscle_group) VALUES
  ('Bench Press', 'chest'), ('Incline Press', 'chest'),
  ('Incline Bench Press', 'chest'), ('Chest Press Machine', 'chest'),
  ('Chest Press', 'chest'), ('Pec Deck', 'chest'),
  ('Cable Crossover', 'chest'), ('Shoulder Press', 'shoulders'),
  ('Lateral Raises', 'shoulders'), ('Tricep Pulldown', 'triceps'),
  ('Overhead Tricep Extension', 'triceps'), ('Tricep Extension', 'triceps'),
  ('Lat Pulldown', 'back'), ('Row', 'back'), ('Pullover', 'back'),
  ('Seated Row', 'back'), ('Barbell Bicep Curl', 'biceps'),
  ('Hammer Curl', 'biceps'), ('Bicep Curl', 'biceps'),
  ('Crunches', 'core'), ('Squat', 'quads'), ('Leg Press', 'quads'),
  ('Leg Extension', 'quads'), ('Adductors', 'legs'), ('Abductors', 'legs'),
  ('Calves', 'legs'), ('Romanian Deadlift', 'hamstrings'),
  ('Leg Curl', 'hamstrings'), ('Hip Thrust', 'glutes'),
  ('Lunges', 'legs'), ('Bulgarian Squat', 'quads'),
  ('Cable Kickback', 'glutes');
```

#### Routines

```sql
INSERT INTO routines (name, type) VALUES
  ('Male Routine', 'hombre'), ('Female Routine', 'mujer');
```

#### Routine Days

```sql
-- Male
WITH r AS (SELECT id FROM routines WHERE type = 'hombre')
INSERT INTO routine_days (routine_id, day_number, day_name, focus)
SELECT r.id, d.day_number, d.day_name, d.focus
FROM r, (VALUES
  (1, 'Monday', 'Chest + Shoulders + Triceps'),
  (2, 'Tuesday', 'Back + Biceps'),
  (3, 'Wednesday', 'Chest + Triceps + Biceps'),
  (4, 'Thursday', 'Quads + Adductors'),
  (5, 'Friday', 'Glutes + Hamstrings')
) AS d(day_number, day_name, focus);

-- Female
WITH r AS (SELECT id FROM routines WHERE type = 'mujer')
INSERT INTO routine_days (routine_id, day_number, day_name, focus)
SELECT r.id, d.day_number, d.day_name, d.focus
FROM r, (VALUES
  (1, 'Monday', 'Glutes + Quads'),
  (2, 'Tuesday', 'Back + Biceps'),
  (3, 'Wednesday', 'Glutes + Hamstrings'),
  (4, 'Thursday', 'Chest + Shoulders + Triceps'),
  (5, 'Friday', 'Glutes + Legs')
) AS d(day_number, day_name, focus);
```

#### Routine Exercises — Male

```sql
-- Monday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'hombre' AND rd.day_number = 1)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Bench Press', 1), ('Incline Press', 2), ('Pec Deck', 3),
  ('Shoulder Press', 4), ('Lateral Raises', 5),
  ('Tricep Pulldown', 6), ('Overhead Tricep Extension', 7)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;

-- Tuesday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'hombre' AND rd.day_number = 2)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Lat Pulldown', 1), ('Row', 2), ('Pullover', 3), ('Seated Row', 4),
  ('Barbell Bicep Curl', 5), ('Hammer Curl', 6), ('Crunches', 7)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;

-- Wednesday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'hombre' AND rd.day_number = 3)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Incline Bench Press', 1), ('Chest Press Machine', 2), ('Cable Crossover', 3),
  ('Tricep Pulldown', 4), ('Tricep Extension', 5), ('Bicep Curl', 6)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;

-- Thursday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'hombre' AND rd.day_number = 4)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Squat', 1), ('Leg Press', 2), ('Leg Extension', 3),
  ('Adductors', 4), ('Calves', 5)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;

-- Friday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'hombre' AND rd.day_number = 5)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Romanian Deadlift', 1), ('Leg Curl', 2), ('Hip Thrust', 3),
  ('Lunges', 4), ('Calves', 5), ('Crunches', 6)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;
```

#### Routine Exercises — Female

```sql
-- Monday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'mujer' AND rd.day_number = 1)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Hip Thrust', 1), ('Squat', 2), ('Leg Press', 3),
  ('Leg Extension', 4), ('Abductors', 5)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;

-- Tuesday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'mujer' AND rd.day_number = 2)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Lat Pulldown', 1), ('Row', 2), ('Pullover', 3),
  ('Bicep Curl', 4), ('Crunches', 5)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;

-- Wednesday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'mujer' AND rd.day_number = 3)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Romanian Deadlift', 1), ('Leg Curl', 2), ('Hip Thrust', 3),
  ('Cable Kickback', 4), ('Abductors', 5)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;

-- Thursday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'mujer' AND rd.day_number = 4)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Chest Press', 1), ('Shoulder Press', 2),
  ('Lateral Raises', 3), ('Tricep Pulldown', 4)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;

-- Friday
WITH day AS (SELECT rd.id FROM routine_days rd JOIN routines r ON r.id = rd.routine_id WHERE r.type = 'mujer' AND rd.day_number = 5)
INSERT INTO routine_exercises (routine_day_id, exercise_id, target_sets, target_reps, exercise_order)
SELECT day.id, e.id, 4, 10, e.ord FROM day, (VALUES
  ('Hip Thrust', 1), ('Bulgarian Squat', 2), ('Lunges', 3),
  ('Abductors', 4), ('Calves', 5), ('Crunches', 6)
) AS e(name, ord) JOIN exercises ON exercises.name = e.name;
```

---

### RLS Policies

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;

-- Profiles: read all, write own (INSERT lo maneja el trigger handle_new_user)
CREATE POLICY "profiles_select_read_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Workouts: read all, write own
CREATE POLICY "workouts_select_read_all" ON workouts FOR SELECT USING (true);
CREATE POLICY "workouts_insert_own" ON workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workouts_update_own" ON workouts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workouts_delete_own" ON workouts FOR DELETE USING (auth.uid() = user_id);

-- Workout entries: read all, write own (via workout ownership)
CREATE POLICY "workout_entries_select_read_all" ON workout_entries FOR SELECT USING (true);
CREATE POLICY "workout_entries_insert_own" ON workout_entries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_id AND workouts.user_id = auth.uid())
);
CREATE POLICY "workout_entries_update_own" ON workout_entries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_id AND workouts.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_id AND workouts.user_id = auth.uid())
);
CREATE POLICY "workout_entries_delete_own" ON workout_entries FOR DELETE USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_id AND workouts.user_id = auth.uid())
);

-- Routine data: read-only (seed data per ADR-003)
CREATE POLICY "routines_select_read_all" ON routines FOR SELECT USING (true);
CREATE POLICY "routine_days_select_read_all" ON routine_days FOR SELECT USING (true);
CREATE POLICY "routine_exercises_select_read_all" ON routine_exercises FOR SELECT USING (true);
CREATE POLICY "exercises_select_read_all" ON exercises FOR SELECT USING (true);

-- Progress photos: PRIVATE — owner only (ADR-005)
CREATE POLICY "progress_photos_select_own" ON progress_photos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "progress_photos_insert_own" ON progress_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_photos_update_own" ON progress_photos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_photos_delete_own" ON progress_photos FOR DELETE USING (auth.uid() = user_id);

-- Nutrition entries: PRIVATE — owner only (ADR-005)
CREATE POLICY "nutrition_entries_select_own" ON nutrition_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nutrition_entries_insert_own" ON nutrition_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nutrition_entries_update_own" ON nutrition_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nutrition_entries_delete_own" ON nutrition_entries FOR DELETE USING (auth.uid() = user_id);

-- Nutrition goals: PRIVATE — owner only (ADR-005)
CREATE POLICY "nutrition_goals_select_own" ON nutrition_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "nutrition_goals_insert_own" ON nutrition_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nutrition_goals_update_own" ON nutrition_goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "nutrition_goals_delete_own" ON nutrition_goals FOR DELETE USING (auth.uid() = user_id);
```

### RPC — `get_profile_by_email` (story 6.2)

`public.profiles` no tiene columna `email` (vive en `auth.users`). El RPC permite a `ProfileRepository.findByEmail` cumplir su contrato en Supabase.

```sql
CREATE OR REPLACE FUNCTION public.get_profile_by_email(target_email TEXT)
RETURNS TABLE (id UUID, display_name TEXT, routine_type TEXT, weight_unit TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, p.display_name, p.routine_type, p.weight_unit, p.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.email = target_email
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_profile_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_profile_by_email(TEXT) TO authenticated;
```

### Storage Bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false);

-- owner_id es TEXT en esta versión de Supabase → cast de auth.uid()
CREATE POLICY "progress_photos_storage_select_own" ON storage.objects
  FOR SELECT USING (bucket_id = 'progress-photos' AND auth.uid()::text = owner_id);
CREATE POLICY "progress_photos_storage_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = owner_id);
CREATE POLICY "progress_photos_storage_update_own" ON storage.objects
  FOR UPDATE USING (bucket_id = 'progress-photos' AND auth.uid()::text = owner_id) WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = owner_id);
CREATE POLICY "progress_photos_storage_delete_own" ON storage.objects
  FOR DELETE USING (bucket_id = 'progress-photos' AND auth.uid()::text = owner_id);
```

---

## Phase 2 Migrations

Phase 2 is [stories/phase-2](../stories/phase-2/readme.md). Every migration is **additive and idempotent** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, guarded backfills). Each has two artifacts kept structurally identical per [ADR-012](./decisions/012-drizzle-orm.md):

| # | Supabase (`supabase/migrations/`) | SQLite (`db/migrations/`, via `drizzle-kit generate` from `db/schema.ts`) | Story |
|---|---|---|---|
| 004 | `004_workout_model_v2.sql` | `0005_workout_model_v2.sql` | [7.1](../stories/phase-2/round-7/story-7.1.md) |
| 005 | `005_exercise_library_seed.sql` | seed in `db/seed.ts` (`seedExerciseLibrary()`) | [7.2](../stories/phase-2/round-7/story-7.2.md) |
| 006 | `006_programs.sql` | `0006_programs.sql` + `seedProgramTemplates()` | [8.1](../stories/phase-2/round-8/story-8.1.md) |
| 007 | `007_progression.sql` | `0007_progression.sql` | [10.2](../stories/phase-2/round-10/story-10.2.md) |
| 008 | `008_body_metrics.sql` | `0008_body_metrics.sql` | [11.1](../stories/phase-2/round-11/story-11.1.md) |
| 009 | `009_ai_weekly_summaries.sql` | `0009_ai_weekly_summaries.sql` | [11.4](../stories/phase-2/round-11/story-11.4.md) |
| 010 | `010_social.sql` | `0010_social.sql` | [12.1](../stories/phase-2/round-12/story-12.1.md) |
| 011 | `011_offline_sync.sql` | `0011_offline_sync.sql` | [12.3](../stories/phase-2/round-12/story-12.3.md) |
| 012 | `012_start_workout.sql` (function only) | none (repository uses a transaction) | [9.1](../stories/phase-2/round-9/story-9.1.md) |
| 013 | `013_finish_workout.sql` (function only) | none | [9.3](../stories/phase-2/round-9/story-9.3.md) |

> Numbering is by Supabase migration order, not by story order: 012/013 are applied after 011 even though 9.1/9.3 ship earlier. Story branches create the file with the next free number at merge time; the number above is only a reference.

SQLite type mapping is the same as Phase 1:

| Postgres | SQLite (Drizzle) |
|---|---|
| `UUID` | `text` |
| `TIMESTAMPTZ` | `integer({ mode: 'timestamp' })` |
| `DATE` | `integer({ mode: 'timestamp_ms' })` |
| `BOOLEAN` | `integer({ mode: 'boolean' })` |
| `REAL` / `DECIMAL` | `real` |
| JSON arrays | `text` (JSON-serialized) |

RLS policies exist only in Supabase. SQLite repositories enforce the same rules in code ([ADR-007](./decisions/007-repository-pattern.md)).

### 004 — Workout model v2 ([ADR-016](./decisions/016-workout-data-model-v2.md), [ADR-017](./decisions/017-exercise-catalog.md))

```sql
-- Exercises: catalog metadata + custom exercises (ADR-017)
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS secondary_muscles TEXT NOT NULL DEFAULT '[]';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment TEXT NOT NULL DEFAULT 'other'
  CHECK (equipment IN ('barbell','dumbbell','machine','cable','kettlebell','bodyweight','band','plate','smith_machine','other'));
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type TEXT NOT NULL DEFAULT 'weight_reps'
  CHECK (exercise_type IN ('weight_reps','bodyweight_reps','weighted_bodyweight','assisted_bodyweight','duration','distance_duration','weight_distance'));
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_name_key;          -- Phase 1 UNIQUE(name)
CREATE UNIQUE INDEX IF NOT EXISTS uq_exercises_system_name ON exercises (lower(name)) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_exercises_owner_name  ON exercises (owner_id, lower(name)) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_owner ON exercises(owner_id);

-- Workouts (ADR-016 §2)
ALTER TABLE workouts ALTER COLUMN routine_day_id DROP NOT NULL;
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_user_id_workout_date_routine_day_id_key; -- verify the name in 001
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Entrenamiento libre';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES routines(id) ON DELETE SET NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS is_deload BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS readiness_score REAL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS uq_workouts_one_in_progress ON workouts(user_id) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_workouts_completed ON workouts(user_id, completed_at DESC) WHERE status = 'completed';

-- Workout exercises (ADR-016 §1)
CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  position INT NOT NULL CHECK (position >= 1),
  superset_group INT,
  rest_seconds INT CHECK (rest_seconds BETWEEN 0 AND 600),
  notes TEXT CHECK (char_length(notes) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises(workout_id, position);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise ON workout_exercises(exercise_id);

-- Sets (ADR-016 §3)
ALTER TABLE workout_entries ADD COLUMN IF NOT EXISTS workout_exercise_id UUID REFERENCES workout_exercises(id) ON DELETE CASCADE;
ALTER TABLE workout_entries ADD COLUMN IF NOT EXISTS set_type TEXT NOT NULL DEFAULT 'normal'
  CHECK (set_type IN ('normal','warmup','drop','failure'));
ALTER TABLE workout_entries ADD COLUMN IF NOT EXISTS rpe REAL
  CHECK (rpe IS NULL OR (rpe BETWEEN 6 AND 10 AND (rpe * 2) = floor(rpe * 2)));
ALTER TABLE workout_entries ADD COLUMN IF NOT EXISTS duration_seconds INT
  CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 86400);
ALTER TABLE workout_entries ADD COLUMN IF NOT EXISTS distance_m REAL CHECK (distance_m IS NULL OR distance_m > 0);
ALTER TABLE workout_entries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE workout_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE workout_entries ALTER COLUMN reps DROP NOT NULL;
-- weight is already DECIMAL(6,2) in Postgres; the SQLite column changes integer → real (ADR-016 Context)
CREATE INDEX IF NOT EXISTS idx_entries_workout_exercise ON workout_entries(workout_exercise_id, set_number);

-- Profiles: training settings (FR-WT-037)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_rest_seconds INT NOT NULL DEFAULT 90
  CHECK (default_rest_seconds BETWEEN 0 AND 600);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bar_weight_kg REAL NOT NULL DEFAULT 20;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_plates_kg TEXT NOT NULL DEFAULT '[25,20,15,10,5,2.5,1.25]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rpe_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS progression_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS readiness_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- RLS: workout_exercises = same as workout_entries (ADR-004)
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_exercises_select_read_all" ON workout_exercises FOR SELECT USING (true);
CREATE POLICY "workout_exercises_insert_own" ON workout_exercises FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
CREATE POLICY "workout_exercises_update_own" ON workout_exercises FOR UPDATE USING (
  EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())) WITH CHECK (
  EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
CREATE POLICY "workout_exercises_delete_own" ON workout_exercises FOR DELETE USING (
  EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));

-- RLS: custom exercises (ADR-017 §1) — the select policy from 002 stays (read-all)
CREATE POLICY "exercises_insert_own" ON exercises FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "exercises_update_own" ON exercises FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Backfill (ADR-016 §6) — idempotent: only touches rows without workout_exercise_id
INSERT INTO workout_exercises (workout_id, exercise_id, position, created_at)
SELECT g.workout_id, g.exercise_id,
       ROW_NUMBER() OVER (PARTITION BY g.workout_id ORDER BY COALESCE(re.exercise_order, 1000), g.first_at),
       g.first_at
FROM (
  SELECT we.workout_id, we.exercise_id, MIN(we.created_at) AS first_at
  FROM workout_entries we WHERE we.workout_exercise_id IS NULL
  GROUP BY we.workout_id, we.exercise_id
) g
JOIN workouts w ON w.id = g.workout_id
LEFT JOIN routine_exercises re ON re.routine_day_id = w.routine_day_id AND re.exercise_id = g.exercise_id;

UPDATE workout_entries we SET
  workout_exercise_id = wx.id,
  completed_at = CASE WHEN we.completed THEN we.created_at END
FROM workout_exercises wx
WHERE we.workout_exercise_id IS NULL AND wx.workout_id = we.workout_id AND wx.exercise_id = we.exercise_id;

UPDATE workouts w SET name = rd.focus
FROM routine_days rd WHERE w.routine_day_id = rd.id AND w.name = 'Entrenamiento libre';
```

> After the backfill, application code treats `workout_entries.workout_exercise_id` as required. The column stays nullable at DB level only so the migration stays reversible.

### 005 — Exercise library seed ([ADR-017](./decisions/017-exercise-catalog.md))

The data file is `db/seed-data/exercises.ts`. It is the single source, and is also used to generate `supabase/migrations/005_exercise_library_seed.sql` through `scripts/generate-exercise-seed.ts`. The upsert key is `lower(name)` among system rows. Legacy rows (L) are **updated in place** (same `id`); new rows are inserted.

#### Exercise Library Seed

Every row also carries `instructions` (2–6 numbered steps, **in Spanish**) authored in the data file. `video_url` is optional. `secondary` is a JSON array.

| # | Name | Equipment | Type | Primary | Secondary | L |
|---|---|---|---|---|---|---|
| 1 | Bench Press | barbell | weight_reps | chest | triceps, shoulders | L |
| 2 | Incline Press | dumbbell | weight_reps | chest | shoulders, triceps | L |
| 3 | Incline Bench Press | barbell | weight_reps | chest | shoulders, triceps | L |
| 4 | Chest Press Machine | machine | weight_reps | chest | triceps, shoulders | L |
| 5 | Chest Press | dumbbell | weight_reps | chest | triceps, shoulders | L |
| 6 | Pec Deck | machine | weight_reps | chest | shoulders | L |
| 7 | Cable Crossover | cable | weight_reps | chest | shoulders | L |
| 8 | Decline Bench Press | barbell | weight_reps | chest | triceps | |
| 9 | Dumbbell Fly | dumbbell | weight_reps | chest | shoulders | |
| 10 | Push Up | bodyweight | bodyweight_reps | chest | triceps, shoulders | |
| 11 | Chest Dip | bodyweight | bodyweight_reps | chest | triceps, shoulders | |
| 12 | Smith Machine Bench Press | smith_machine | weight_reps | chest | triceps, shoulders | |
| 13 | Incline Cable Fly | cable | weight_reps | chest | shoulders | |
| 14 | Shoulder Press | machine | weight_reps | shoulders | triceps | L |
| 15 | Lateral Raises | dumbbell | weight_reps | shoulders | — | L |
| 16 | Overhead Press | barbell | weight_reps | shoulders | triceps, upper_back | |
| 17 | Seated Dumbbell Shoulder Press | dumbbell | weight_reps | shoulders | triceps | |
| 18 | Arnold Press | dumbbell | weight_reps | shoulders | triceps | |
| 19 | Cable Lateral Raise | cable | weight_reps | shoulders | — | |
| 20 | Front Raise | dumbbell | weight_reps | shoulders | chest | |
| 21 | Rear Delt Fly | dumbbell | weight_reps | shoulders | upper_back | |
| 22 | Reverse Pec Deck | machine | weight_reps | shoulders | upper_back | |
| 23 | Face Pull | cable | weight_reps | shoulders | upper_back, traps | |
| 24 | Upright Row | barbell | weight_reps | shoulders | traps, biceps | |
| 25 | Tricep Pulldown | cable | weight_reps | triceps | — | L |
| 26 | Overhead Tricep Extension | dumbbell | weight_reps | triceps | — | L |
| 27 | Tricep Extension | machine | weight_reps | triceps | — | L |
| 28 | Skull Crusher | barbell | weight_reps | triceps | — | |
| 29 | Close Grip Bench Press | barbell | weight_reps | triceps | chest, shoulders | |
| 30 | Bench Dip | bodyweight | bodyweight_reps | triceps | chest, shoulders | |
| 31 | Tricep Kickback | dumbbell | weight_reps | triceps | — | |
| 32 | Lat Pulldown | cable | weight_reps | lats | biceps, upper_back | L |
| 33 | Row | barbell | weight_reps | upper_back | lats, biceps, lower_back | L |
| 34 | Pullover | dumbbell | weight_reps | lats | chest, triceps | L |
| 35 | Seated Row | cable | weight_reps | upper_back | lats, biceps | L |
| 36 | Pull Up | bodyweight | bodyweight_reps | lats | biceps, upper_back | |
| 37 | Chin Up | bodyweight | bodyweight_reps | lats | biceps | |
| 38 | Assisted Pull Up | machine | assisted_bodyweight | lats | biceps, upper_back | |
| 39 | Weighted Pull Up | plate | weighted_bodyweight | lats | biceps, upper_back | |
| 40 | Dumbbell Row | dumbbell | weight_reps | upper_back | lats, biceps | |
| 41 | T-Bar Row | barbell | weight_reps | upper_back | lats, biceps | |
| 42 | Chest Supported Row | machine | weight_reps | upper_back | lats, biceps | |
| 43 | Straight Arm Pulldown | cable | weight_reps | lats | triceps | |
| 44 | Deadlift | barbell | weight_reps | lower_back | hamstrings, glutes, traps | |
| 45 | Back Extension | bodyweight | bodyweight_reps | lower_back | glutes, hamstrings | |
| 46 | Dumbbell Shrug | dumbbell | weight_reps | traps | forearms | |
| 47 | Barbell Shrug | barbell | weight_reps | traps | forearms | |
| 48 | Superman | bodyweight | bodyweight_reps | lower_back | glutes | |
| 49 | Barbell Bicep Curl | barbell | weight_reps | biceps | forearms | L |
| 50 | Hammer Curl | dumbbell | weight_reps | biceps | forearms | L |
| 51 | Bicep Curl | dumbbell | weight_reps | biceps | forearms | L |
| 52 | Preacher Curl | barbell | weight_reps | biceps | — | |
| 53 | Cable Curl | cable | weight_reps | biceps | — | |
| 54 | Incline Dumbbell Curl | dumbbell | weight_reps | biceps | — | |
| 55 | Concentration Curl | dumbbell | weight_reps | biceps | — | |
| 56 | Wrist Curl | dumbbell | weight_reps | forearms | — | |
| 57 | Farmer's Walk | dumbbell | weight_distance | forearms | traps, abdominals | |
| 58 | Crunches | bodyweight | bodyweight_reps | abdominals | — | L |
| 59 | Plank | bodyweight | duration | abdominals | shoulders | |
| 60 | Side Plank | bodyweight | duration | abdominals | — | |
| 61 | Hanging Leg Raise | bodyweight | bodyweight_reps | abdominals | — | |
| 62 | Cable Crunch | cable | weight_reps | abdominals | — | |
| 63 | Russian Twist | bodyweight | bodyweight_reps | abdominals | — | |
| 64 | Ab Wheel Rollout | other | bodyweight_reps | abdominals | shoulders, lats | |
| 65 | Dead Bug | bodyweight | bodyweight_reps | abdominals | — | |
| 66 | Mountain Climber | bodyweight | bodyweight_reps | abdominals | shoulders, quadriceps | |
| 67 | Squat | barbell | weight_reps | quadriceps | glutes, hamstrings, lower_back | L |
| 68 | Leg Press | machine | weight_reps | quadriceps | glutes, hamstrings | L |
| 69 | Leg Extension | machine | weight_reps | quadriceps | — | L |
| 70 | Bulgarian Squat | dumbbell | weight_reps | quadriceps | glutes, hamstrings | L |
| 71 | Lunges | dumbbell | weight_reps | quadriceps | glutes, hamstrings | L |
| 72 | Front Squat | barbell | weight_reps | quadriceps | glutes, abdominals | |
| 73 | Goblet Squat | dumbbell | weight_reps | quadriceps | glutes | |
| 74 | Hack Squat | machine | weight_reps | quadriceps | glutes | |
| 75 | Walking Lunge | dumbbell | weight_reps | quadriceps | glutes, hamstrings | |
| 76 | Step Up | dumbbell | weight_reps | quadriceps | glutes | |
| 77 | Smith Machine Squat | smith_machine | weight_reps | quadriceps | glutes | |
| 78 | Bodyweight Squat | bodyweight | bodyweight_reps | quadriceps | glutes | |
| 79 | Bodyweight Lunge | bodyweight | bodyweight_reps | quadriceps | glutes | |
| 80 | Romanian Deadlift | barbell | weight_reps | hamstrings | glutes, lower_back | L |
| 81 | Leg Curl | machine | weight_reps | hamstrings | — | L |
| 82 | Seated Leg Curl | machine | weight_reps | hamstrings | — | |
| 83 | Dumbbell Romanian Deadlift | dumbbell | weight_reps | hamstrings | glutes, lower_back | |
| 84 | Good Morning | barbell | weight_reps | hamstrings | lower_back, glutes | |
| 85 | Nordic Curl | bodyweight | bodyweight_reps | hamstrings | — | |
| 86 | Hip Thrust | barbell | weight_reps | glutes | hamstrings | L |
| 87 | Cable Kickback | cable | weight_reps | glutes | — | L |
| 88 | Glute Bridge | bodyweight | bodyweight_reps | glutes | hamstrings | |
| 89 | Single Leg Glute Bridge | bodyweight | bodyweight_reps | glutes | hamstrings | |
| 90 | Hip Thrust Machine | machine | weight_reps | glutes | hamstrings | |
| 91 | Sumo Deadlift | barbell | weight_reps | glutes | adductors, hamstrings, lower_back | |
| 92 | Kettlebell Swing | kettlebell | weight_reps | glutes | hamstrings, lower_back | |
| 93 | Cable Pull Through | cable | weight_reps | glutes | hamstrings | |
| 94 | Adductors | machine | weight_reps | adductors | — | L |
| 95 | Abductors | machine | weight_reps | abductors | glutes | L |
| 96 | Calves | machine | weight_reps | calves | — | L |
| 97 | Seated Calf Raise | machine | weight_reps | calves | — | |
| 98 | Treadmill | machine | distance_duration | cardio | — | |
| 99 | Running | other | distance_duration | cardio | — | |
| 100 | Walking | other | distance_duration | cardio | — | |
| 101 | Stationary Bike | machine | distance_duration | cardio | — | |
| 102 | Cycling | other | distance_duration | cardio | — | |
| 103 | Elliptical | machine | duration | cardio | — | |
| 104 | Rowing Machine | machine | distance_duration | cardio | upper_back, quadriceps | |
| 105 | Stair Climber | machine | duration | cardio | glutes, quadriceps | |
| 106 | Jump Rope | other | duration | cardio | calves | |
| 107 | Burpee | bodyweight | bodyweight_reps | full_body | chest, quadriceps | |

Five legacy names are ambiguous. Their names are kept for history continuity ([FR-EL-010](../prd/features/exercise-library.md#fr-el-010)), and the instructions make the variant explicit:

| Legacy name | Actual variant |
|---|---|
| `Row` | Barbell bent-over row |
| `Chest Press` | Flat dumbbell press |
| `Incline Press` | Incline dumbbell press |
| `Calves` | Standing calf raise |
| `Leg Curl` | Lying leg curl |

### 006 — Programs ([ADR-018](./decisions/018-user-owned-programs.md), [ADR-019](./decisions/019-rotation-scheduling-and-onboarding.md))

```sql
ALTER TABLE routines ALTER COLUMN type DROP NOT NULL;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS slug TEXT;                       -- templates only
ALTER TABLE routines ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES routines(id) ON DELETE SET NULL;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS level TEXT CHECK (level IN ('beginner','intermediate','advanced'));
ALTER TABLE routines ADD COLUMN IF NOT EXISTS goal TEXT CHECK (goal IN ('strength','hypertrophy','general'));
ALTER TABLE routines ADD COLUMN IF NOT EXISTS days_per_week INT CHECK (days_per_week BETWEEN 1 AND 7);
ALTER TABLE routines ADD COLUMN IF NOT EXISTS equipment_profile TEXT CHECK (equipment_profile IN ('full_gym','dumbbells','bodyweight'));
ALTER TABLE routines ADD COLUMN IF NOT EXISTS focus TEXT CHECK (focus IN ('balanced','glutes_legs','upper_body'));
ALTER TABLE routines ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE routines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE routines ADD COLUMN IF NOT EXISTS rotation_anchor_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); -- FR-RT-013: rotation counts workouts completed after this
CREATE UNIQUE INDEX IF NOT EXISTS uq_routines_slug ON routines(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_routines_owner ON routines(owner_id);

ALTER TABLE routine_days DROP CONSTRAINT IF EXISTS routine_days_day_number_check;
ALTER TABLE routine_days ADD CONSTRAINT routine_days_day_number_check CHECK (day_number BETWEEN 1 AND 14);
ALTER TABLE routine_days ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE routine_days ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
-- Reordering permutes positions with ONE statement (UPDATE … SET day_number = CASE …), so uniqueness must be checked
-- at statement end, not per row. DEFERRABLE INITIALLY IMMEDIATE does that. The CHECK 1..14 forbids temporary values.
ALTER TABLE routine_days DROP CONSTRAINT IF EXISTS routine_days_routine_id_day_number_key;      -- verify name in 001
ALTER TABLE routine_days ADD CONSTRAINT routine_days_routine_id_day_number_key
  UNIQUE (routine_id, day_number) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE routine_exercises DROP CONSTRAINT IF EXISTS routine_exercises_routine_day_id_exercise_order_key; -- verify name in 001
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_routine_day_id_exercise_order_key
  UNIQUE (routine_day_id, exercise_order) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE routine_exercises ADD COLUMN IF NOT EXISTS target_reps_min INT;
ALTER TABLE routine_exercises ADD COLUMN IF NOT EXISTS target_reps_max INT;
ALTER TABLE routine_exercises ADD COLUMN IF NOT EXISTS warmup_sets INT NOT NULL DEFAULT 0 CHECK (warmup_sets BETWEEN 0 AND 5);
ALTER TABLE routine_exercises ADD COLUMN IF NOT EXISTS rest_seconds INT CHECK (rest_seconds BETWEEN 0 AND 600);
ALTER TABLE routine_exercises ADD COLUMN IF NOT EXISTS superset_group INT;
ALTER TABLE routine_exercises ADD COLUMN IF NOT EXISTS target_rpe REAL CHECK (target_rpe IS NULL OR target_rpe BETWEEN 6 AND 10);
ALTER TABLE routine_exercises ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE routine_exercises SET target_reps_min = GREATEST(1, target_reps - 2), target_reps_max = target_reps + 2
  WHERE target_reps_min IS NULL;                                             -- 10 → 8–12
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_reps_range
  CHECK (target_reps_min >= 1 AND target_reps_min <= target_reps_max AND target_reps_max <= 3600);
-- For duration-type exercises the range is in SECONDS (≤ 3600). The domain enforces ≤ 100 for rep-based types
-- (RoutineExerciseRules, FR-RT-008); the DB only guards the absolute bound.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_program_id UUID REFERENCES routines(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_goal TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_level TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS days_per_week INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipment_profile TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS focus TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- RLS: templates immutable; user programs write-own (ADR-018 §2). The select policies from 002 stay (read-all).
CREATE POLICY "routines_insert_own" ON routines FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "routines_update_own" ON routines FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "routines_delete_own" ON routines FOR DELETE USING (owner_id = auth.uid());
CREATE POLICY "routine_days_write_own" ON routine_days FOR ALL
  USING (EXISTS (SELECT 1 FROM routines r WHERE r.id = routine_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM routines r WHERE r.id = routine_id AND r.owner_id = auth.uid()));
CREATE POLICY "routine_exercises_write_own" ON routine_exercises FOR ALL
  USING (EXISTS (SELECT 1 FROM routine_days d JOIN routines r ON r.id = d.routine_id
                 WHERE d.id = routine_day_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM routine_days d JOIN routines r ON r.id = d.routine_id
                 WHERE d.id = routine_day_id AND r.owner_id = auth.uid()));
```

> `FOR ALL` policies also grant SELECT. That is harmless, because select is already read-all.

**Data steps (same migration, after the DDL):**

1. Turn the two Phase 1 routines into templates in place:
   - `hombre` → slug `male-5-day-split`; `mujer` → slug `female-glute-focus-5-day`;
   - set `is_template = true` and the metadata from the table below;
   - set `routine_days.day_name = focus` (e.g. "Chest + Shoulders + Triceps").

   Their rows keep their IDs, so Phase 1 workouts stay linked.
2. Insert templates 3–7 (below).
3. For every profile without `active_program_id`: deep-copy the template matching `routine_type`, then set `owner_id`, `source_template_id` and `active_program_id`.
   - In Supabase mode this is the SQL function `adopt_template(p_user UUID, p_template UUID) RETURNS UUID` (`SECURITY INVOKER`), also reused by the app.
   - The SQLite repository implements the same copy in a transaction.

**Transactional SQL functions (Supabase).** PostgREST has no multi-statement transactions, so every multi-row write of the routines context is an RPC in `006_programs.sql`. All are `SECURITY INVOKER`, so RLS still applies. The SQLite repositories implement the same operations with `db.transaction(...)`.

| Function | Returns | Used by |
|---|---|---|
| `adopt_template(p_user UUID, p_template UUID)` | new program id | `AdoptTemplateUseCase`, user migration |
| `copy_program(p_user UUID, p_source UUID)` | new program id | `CopyProgramUseCase` (sibling program, FR-RT-006) |
| `copy_routine(p_user UUID, p_source_routine UUID, p_target_program UUID)` | new routine id | `CopyRoutineUseCase`, `SaveRoutineFromWorkoutUseCase` (social) |
| `save_routine(p_user UUID, p_payload JSONB)` | routine id | `SaveRoutineUseCase`, `SaveWorkoutAsRoutineUseCase` — upserts the `routine_days` row, replaces its `routine_exercises` |
| `reorder_routine_days(p_user UUID, p_program UUID, p_ordered_ids UUID[])` | void | `ReorderRoutinesUseCase` — rewrites `day_number` 1..n in one `UPDATE … CASE`, sets `rotation_anchor_at = NOW()` |
| `duplicate_routine(p_user UUID, p_routine UUID)` | new routine id | `DuplicateRoutineUseCase` (story 8.2) |
| `delete_routine(p_user UUID, p_routine UUID)` | void | `DeleteRoutineUseCase` — delete guard + compaction of `day_number` (story 8.2) |
| `set_routine_archived(p_user UUID, p_routine UUID, p_archived BOOLEAN)` | void | `ArchiveRoutineUseCase`, restore — renumbers (story 8.2) |

**Workout functions (migration 004 / later stories).** Same rules (`SECURITY INVOKER`, SQLite equivalent with `db.transaction`):

| Function | Shipped by | Purpose |
|---|---|---|
| `upsert_workout_exercise(p_payload JSONB)` | story 7.1 (migration 004) | LWW upsert guarded by `updated_at` ([ADR-025 §5](./decisions/025-offline-live-workout.md)) |
| `upsert_workout_set(p_payload JSONB)` | story 7.1 (migration 004) | same, for `workout_entries` |
| `start_workout_v2(p_user UUID, p_skeleton JSONB)` | story 9.1 (new migration `012_start_workout.sql`) | creates the workout + exercises + empty sets atomically |
| `finish_workout(p_user UUID, p_workout UUID, p_plan JSONB)` | story 9.3 (new migration `013_finish_workout.sql`) | applies a `FinishPlan` atomically |

Copy functions skip exercises the target user may not use (custom exercises owned by someone else, [ADR-017 §1](./decisions/017-exercise-catalog.md)) and set `rotation_anchor_at = NOW()` on the new program.

#### Program Templates Seed

Data file: `db/seed-data/program-templates.ts`. Notation: `sets × min–max @rest s`. All exercises reference names from the [Exercise Library Seed](#exercise-library-seed).

| # | Slug | Name | Level | Goal | Days | Equipment | Focus |
|---|---|---|---|---|---|---|---|
| 1 | `male-5-day-split` | Male 5-Day Split | intermediate | hypertrophy | 5 | full_gym | upper_body |
| 2 | `female-glute-focus-5-day` | Female Glute Focus 5-Day | intermediate | hypertrophy | 5 | full_gym | glutes_legs |
| 3 | `full-body-beginner-3-day` | Full Body Beginner 3-Day | beginner | general | 3 | full_gym | balanced |
| 4 | `upper-lower-4-day` | Upper / Lower 4-Day | intermediate | strength | 4 | full_gym | balanced |
| 5 | `push-pull-legs-6-day` | Push Pull Legs 6-Day | advanced | hypertrophy | 6 | full_gym | balanced |
| 6 | `dumbbell-full-body-3-day` | Dumbbell Full Body 3-Day | beginner | general | 3 | dumbbells | balanced |
| 7 | `bodyweight-home-3-day` | Bodyweight Home 3-Day | beginner | general | 3 | bodyweight | balanced |

**1 · Male 5-Day Split** and **2 · Female Glute Focus 5-Day** use exactly the Phase 1 routine days and exercises ([Routine Exercises — Male](#routine-exercises--male), [— Female](#routine-exercises--female)). Every exercise is `4 × 8–12 @90`, except the first exercise of each day, which is `@120`.

**3 · Full Body Beginner 3-Day**

| Routine | Exercises |
|---|---|
| Full Body A | Squat 3×5–8 @150 · Bench Press 3×5–8 @150 · Seated Row 3×8–12 @90 · Lateral Raises 2×10–15 @60 · Crunches 3×12–20 @60 |
| Full Body B | Romanian Deadlift 3×6–10 @150 · Overhead Press 3×5–8 @150 · Lat Pulldown 3×8–12 @90 · Leg Press 2×10–15 @90 · Hanging Leg Raise 3×8–15 @60 |
| Full Body C | Leg Press 3×8–12 @120 · Incline Press 3×8–12 @90 · Dumbbell Row 3×8–12 @90 · Leg Curl 3×10–15 @60 · Bicep Curl 2×10–15 @60 · Tricep Pulldown 2×10–15 @60 |

**4 · Upper / Lower 4-Day**

| Routine | Exercises |
|---|---|
| Upper A | Bench Press 4×5–8 @180 · Row 4×5–8 @150 · Overhead Press 3×6–10 @120 · Lat Pulldown 3×8–12 @90 · Skull Crusher 2×10–12 @60 · Barbell Bicep Curl 2×10–12 @60 |
| Lower A | Squat 4×5–8 @180 · Romanian Deadlift 3×6–10 @150 · Leg Press 3×8–12 @120 · Leg Curl 3×10–12 @60 · Calves 3×10–15 @60 |
| Upper B | Incline Bench Press 4×6–10 @150 · Pull Up 4×5–10 @120 · Seated Dumbbell Shoulder Press 3×8–12 @90 · Seated Row 3×8–12 @90 · Lateral Raises 3×12–15 @60 · Hammer Curl 2×10–12 @60 |
| Lower B | Deadlift 3×3–5 @180 · Front Squat 3×6–8 @150 · Hip Thrust 3×8–12 @90 · Leg Extension 3×10–15 @60 · Hanging Leg Raise 3×8–15 @60 |

**5 · Push Pull Legs 6-Day**

| Routine | Exercises |
|---|---|
| Push A | Bench Press 4×6–10 @150 · Overhead Press 3×6–10 @120 · Incline Press 3×8–12 @90 · Lateral Raises 4×12–15 @60 · Tricep Pulldown 3×10–12 @60 · Overhead Tricep Extension 3×10–12 @60 |
| Pull A | Deadlift 3×3–5 @180 · Pull Up 4×6–10 @120 · Row 3×8–12 @90 · Face Pull 3×12–15 @60 · Barbell Bicep Curl 3×8–12 @60 · Hammer Curl 3×10–12 @60 |
| Legs A | Squat 4×6–10 @180 · Romanian Deadlift 3×8–10 @120 · Leg Press 3×10–12 @90 · Leg Curl 3×10–12 @60 · Calves 4×10–15 @60 |
| Push B | Incline Bench Press 4×6–10 @150 · Seated Dumbbell Shoulder Press 3×8–12 @90 · Cable Crossover 3×12–15 @60 · Cable Lateral Raise 3×12–15 @60 · Skull Crusher 3×8–12 @60 · Chest Dip 3×8–12 @90 |
| Pull B | Lat Pulldown 4×8–12 @90 · Chest Supported Row 3×8–12 @90 · Dumbbell Row 3×8–12 @90 · Reverse Pec Deck 3×12–15 @60 · Incline Dumbbell Curl 3×10–12 @60 · Cable Curl 3×10–12 @60 |
| Legs B | Front Squat 3×6–10 @150 · Hip Thrust 3×8–12 @90 · Bulgarian Squat 3×8–12 @90 · Leg Extension 3×12–15 @60 · Seated Leg Curl 3×10–12 @60 · Seated Calf Raise 4×12–15 @60 |

**6 · Dumbbell Full Body 3-Day**

| Routine | Exercises |
|---|---|
| Dumbbell A | Goblet Squat 3×8–12 @90 · Chest Press 3×8–12 @90 · Dumbbell Row 3×8–12 @90 · Lateral Raises 2×12–15 @60 · Crunches 3×12–20 @60 |
| Dumbbell B | Dumbbell Romanian Deadlift 3×8–12 @90 · Seated Dumbbell Shoulder Press 3×8–12 @90 · Pullover 3×10–12 @60 · Walking Lunge 3×10–12 @90 · Hammer Curl 2×10–12 @60 |
| Dumbbell C | Bulgarian Squat 3×8–12 @90 · Incline Press 3×8–12 @90 · Dumbbell Row 3×10–12 @90 · Glute Bridge 3×12–15 @60 · Tricep Kickback 2×10–15 @60 |

**7 · Bodyweight Home 3-Day**

| Routine | Exercises |
|---|---|
| Home A | Bodyweight Squat 3×12–20 @60 · Push Up 3×6–15 @90 · Glute Bridge 3×12–20 @60 · Crunches 3×12–20 @45 · Burpee 3×8–12 @90 |
| Home B | Bodyweight Lunge 3×10–15 @60 · Superman 3×10–15 @45 · Bench Dip 3×8–15 @60 · Dead Bug 3×10–15 @45 · Mountain Climber 3×20–30 @45 |
| Home C | Bodyweight Squat 3×15–25 @60 · Push Up 3×8–15 @90 · Single Leg Glute Bridge 3×10–15 @60 · Superman 3×10–15 @45 · Russian Twist 3×16–24 @45 · Burpee 3×8–12 @90 |

### 007 — Progression ([ADR-021](./decisions/021-progression-engine.md), [ADR-022](./decisions/022-readiness-and-recovery.md))

```sql
CREATE TABLE IF NOT EXISTS exercise_progression_overrides (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  rep_min INT CHECK (rep_min >= 1),
  rep_max INT CHECK (rep_max <= 100),
  range_until DATE,                                -- "Cambiar rango" expiry (4 weeks)
  dismissed_until_exposures INT,                   -- "Ignorar": remaining exposures that suppress the plateau
  rebuild_pending BOOLEAN NOT NULL DEFAULT FALSE,  -- "Bajar y reconstruir": next session −10 %
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, exercise_id),
  CHECK (rep_min IS NULL OR rep_max IS NULL OR rep_min <= rep_max)
);

CREATE TABLE IF NOT EXISTS readiness_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  sleep INT NOT NULL CHECK (sleep BETWEEN 1 AND 5),
  energy INT NOT NULL CHECK (energy BETWEEN 1 AND 5),
  soreness INT NOT NULL CHECK (soreness BETWEEN 1 AND 5),
  score REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_readiness_user ON readiness_checkins(user_id, created_at DESC);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deload_until DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_deload_at DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deload_snoozed_until DATE;

ALTER TABLE exercise_progression_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progression_overrides_own" ON exercise_progression_overrides FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "readiness_checkins_own" ON readiness_checkins FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 008 — Body metrics ([ADR-023](./decisions/023-body-metrics-privacy.md))

```sql
CREATE TABLE IF NOT EXISTS body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  measured_on DATE NOT NULL,
  weight_kg REAL CHECK (weight_kg BETWEEN 20 AND 400),
  body_fat_pct REAL CHECK (body_fat_pct BETWEEN 2 AND 70),
  neck_cm REAL, shoulders_cm REAL, chest_cm REAL,
  left_bicep_cm REAL, right_bicep_cm REAL, left_forearm_cm REAL, right_forearm_cm REAL,
  abdomen_cm REAL, waist_cm REAL, hips_cm REAL,
  left_thigh_cm REAL, right_thigh_cm REAL, left_calf_cm REAL, right_calf_cm REAL,
  notes TEXT CHECK (char_length(notes) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, measured_on)
);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user ON body_measurements(user_id, measured_on DESC);
-- The length ranges of FR-BM-001 are validated in the domain (BodyMetricRules), not as CHECKs.

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "body_measurements_select_own" ON body_measurements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "body_measurements_insert_own" ON body_measurements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "body_measurements_update_own" ON body_measurements FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "body_measurements_delete_own" ON body_measurements FOR DELETE USING (auth.uid() = user_id);
```

### 009 — AI weekly summaries ([ADR-026](./decisions/026-weekly-ai-coach-summary.md))

```sql
CREATE TABLE IF NOT EXISTS ai_weekly_summaries (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,                 -- ISO Monday in profiles.timezone
  facts_json TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  model TEXT NOT NULL,                      -- Gemini model id (AIAnalysisRules.DefaultModel) | 'template'
  regenerations INT NOT NULL DEFAULT 0 CHECK (regenerations BETWEEN 0 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start)
);
ALTER TABLE ai_weekly_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_weekly_summaries_own" ON ai_weekly_summaries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 010 — Social ([ADR-024](./decisions/024-social-interactions.md))

```sql
CREATE TABLE IF NOT EXISTS workout_likes (
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workout_id, user_id)
);

CREATE TABLE IF NOT EXISTS workout_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workout_comments_workout ON workout_comments(workout_id, created_at);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE workout_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_likes_select_read_all" ON workout_likes FOR SELECT USING (true);
CREATE POLICY "workout_likes_insert_own" ON workout_likes FOR INSERT WITH CHECK (
  auth.uid() = user_id AND NOT EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
CREATE POLICY "workout_likes_delete_own" ON workout_likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "workout_comments_select_read_all" ON workout_comments FOR SELECT USING (true);
CREATE POLICY "workout_comments_insert_own" ON workout_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workout_comments_update_own" ON workout_comments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workout_comments_delete_own_or_workout_owner" ON workout_comments FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
```

### 011 — Offline sync ([ADR-025](./decisions/025-offline-live-workout.md))

```sql
ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE workout_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_workout_exercises_live ON workout_exercises(workout_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entries_live ON workout_entries(workout_exercise_id) WHERE deleted_at IS NULL;
-- Tombstone purge: rows with deleted_at < NOW() - INTERVAL '30 days' are hard-deleted by
-- PurgeTombstonesUseCase, run opportunistically on login (no cron on the free tier).
```

### Phase 2 table access summary

| Table | Select | Write | Decision |
|---|---|---|---|
| `exercises` (system) | all | none (seed) | [ADR-017](./decisions/017-exercise-catalog.md) |
| `exercises` (custom) | all | owner | [ADR-017](./decisions/017-exercise-catalog.md) |
| `routines` / `routine_days` / `routine_exercises` (templates) | all | none (seed) | [ADR-018](./decisions/018-user-owned-programs.md) |
| same (user programs) | all | owner | [ADR-018](./decisions/018-user-owned-programs.md) |
| `workout_exercises` | all | via workout owner | [ADR-016](./decisions/016-workout-data-model-v2.md) |
| `exercise_progression_overrides` | owner | owner | [ADR-021](./decisions/021-progression-engine.md) |
| `readiness_checkins` | owner | owner | [ADR-022](./decisions/022-readiness-and-recovery.md) |
| `body_measurements` | owner | owner | [ADR-023](./decisions/023-body-metrics-privacy.md) |
| `ai_weekly_summaries` | owner | owner | [ADR-026](./decisions/026-weekly-ai-coach-summary.md) |
| `workout_likes` | all | own like, never on own workout | [ADR-024](./decisions/024-social-interactions.md) |
| `workout_comments` | all | own; the workout owner may delete | [ADR-024](./decisions/024-social-interactions.md) |
