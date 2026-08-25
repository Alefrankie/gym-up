-- ============================================================================
-- Gym-Up — 001_initial_schema.sql (Story 6.1 · Supabase)
-- ============================================================================
-- Esquema Postgres portado de docs/architecture/database-schema.md.
-- Ajustes vs. Round-1 SQLite (per story-6.1):
--   * TEXT PK/FK  -> uuid
--   * id          -> uuid PRIMARY KEY DEFAULT gen_random_uuid()
--   * DATETIME    -> timestamptz
--   * Trigger auth.users -> profiles (handle_new_user)
--
-- Alcance de 6.1: SOLO tablas + índices + trigger.
-- RLS policies y storage bucket se agregan en stories 6.2 / 6.3.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES (FK a auth.users; el trigger crea la fila al insertar en auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  routine_type TEXT NOT NULL CHECK (routine_type IN ('hombre', 'mujer')),
  weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lbs')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, routine_type, weight_unit)
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- EXERCISES
-- ----------------------------------------------------------------------------
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  muscle_group TEXT NOT NULL
);
CREATE INDEX idx_exercises_muscle_group ON public.exercises(muscle_group);

-- ----------------------------------------------------------------------------
-- ROUTINES
-- ----------------------------------------------------------------------------
CREATE TABLE public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hombre', 'mujer'))
);

-- ----------------------------------------------------------------------------
-- ROUTINE DAYS
-- ----------------------------------------------------------------------------
CREATE TABLE public.routine_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  day_name TEXT NOT NULL,
  focus TEXT NOT NULL,
  UNIQUE(routine_id, day_number)
);
CREATE INDEX idx_routine_days_routine ON public.routine_days(routine_id);

-- ----------------------------------------------------------------------------
-- ROUTINE EXERCISES
-- ----------------------------------------------------------------------------
CREATE TABLE public.routine_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_day_id UUID NOT NULL REFERENCES public.routine_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  target_sets INT NOT NULL DEFAULT 4,
  target_reps INT NOT NULL DEFAULT 10,
  exercise_order INT NOT NULL,
  UNIQUE(routine_day_id, exercise_order)
);
CREATE INDEX idx_routine_exercises_day ON public.routine_exercises(routine_day_id);

-- ----------------------------------------------------------------------------
-- WORKOUTS
-- ----------------------------------------------------------------------------
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  routine_day_id UUID NOT NULL REFERENCES public.routine_days(id),
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, workout_date, routine_day_id)
);
CREATE INDEX idx_workouts_user_date ON public.workouts(user_id, workout_date DESC);
CREATE INDEX idx_workouts_status ON public.workouts(user_id, status);

-- ----------------------------------------------------------------------------
-- WORKOUT ENTRIES
-- ----------------------------------------------------------------------------
CREATE TABLE public.workout_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id),
  set_number INT NOT NULL,
  reps INT NOT NULL,
  weight DECIMAL(6,2) NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_entries_workout ON public.workout_entries(workout_id);
CREATE INDEX idx_entries_exercise ON public.workout_entries(exercise_id);

-- ----------------------------------------------------------------------------
-- PROGRESS PHOTOS
-- ----------------------------------------------------------------------------
CREATE TABLE public.progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  photo_date DATE NOT NULL DEFAULT CURRENT_DATE,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_photos_user ON public.progress_photos(user_id, photo_date DESC);