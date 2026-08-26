# Database Schema

Parent: [./readme.md](./readme.md) · Up: [../README.md](../README.md)

## Decisions

- Routines as seed data: [ADR-003](./decisions/003-routines-seed-data.md)
- RLS model: [ADR-004](./decisions/004-rls-visibility.md)
- Private photos: [ADR-005](./decisions/005-private-photos.md)
- kg storage: [ADR-006](./decisions/006-kg-storage.md)

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
