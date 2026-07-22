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

-- Profiles: read all, write own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Workouts: read all, write own
CREATE POLICY "workouts_select" ON workouts FOR SELECT USING (true);
CREATE POLICY "workouts_insert" ON workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workouts_update" ON workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "workouts_delete" ON workouts FOR DELETE USING (auth.uid() = user_id);

-- Workout entries: read all, write own (via workout ownership)
CREATE POLICY "entries_select" ON workout_entries FOR SELECT USING (true);
CREATE POLICY "entries_insert" ON workout_entries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_id AND workouts.user_id = auth.uid())
);
CREATE POLICY "entries_update" ON workout_entries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_id AND workouts.user_id = auth.uid())
);
CREATE POLICY "entries_delete" ON workout_entries FOR DELETE USING (
  EXISTS (SELECT 1 FROM workouts WHERE workouts.id = workout_id AND workouts.user_id = auth.uid())
);

-- Routine data: read-only
CREATE POLICY "routines_read" ON routines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "routine_days_read" ON routine_days FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "routine_exercises_read" ON routine_exercises FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "exercises_read" ON exercises FOR SELECT USING (auth.role() = 'authenticated');

-- Progress photos: PRIVATE — owner only
CREATE POLICY "photos_select" ON progress_photos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "photos_insert" ON progress_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photos_delete" ON progress_photos FOR DELETE USING (auth.uid() = user_id);
```

### Storage Bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false);

CREATE POLICY "photos_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
```
