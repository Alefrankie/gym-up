-- ============================================================================
-- Gym-Up — 002_nutrition_and_rls.sql (Story 6.2 · Supabase)
-- ============================================================================
-- Alcance de 6.2:
--   * Tablas de nutrition (nutrition_entries, nutrition_goals) — ausentes en
--     001 (Round 5 las agregó a SQLite pero database-schema.md quedó stale).
--   * RLS en las 10 tablas public (ADR-004 write-own/read-all; ADR-005
--     owner-only en progress_photos + nutrition).
--   * RLS en storage.objects para el bucket privado `progress-photos`
--     (ADR-005). El bucket + SupabasePhotoStorageAdapter se crean en 6.3.
--   * RPC get_profile_by_email (SECURITY DEFINER) — consulta auth.users
--     porque public.profiles no tiene columna email (vive en auth.users).
--
-- NOTA: 001 ya fue aplicada al remoto; esta migración es incremental.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) TABLAS DE NUTRITION
-- ----------------------------------------------------------------------------
CREATE TABLE public.nutrition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
CREATE INDEX idx_nutrition_entries_user ON public.nutrition_entries(user_id, created_at DESC);

CREATE TABLE public.nutrition_goals (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  daily_calorie_goal INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2) RLS — PROFILES (write-own / read-all per ADR-004)
--    INSERT lo maneja el trigger handle_new_user() (SECURITY DEFINER, bypass).
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_read_all" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 3) RLS — WORKOUTS (write-own / read-all per ADR-004)
-- ----------------------------------------------------------------------------
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workouts_select_read_all" ON public.workouts
  FOR SELECT USING (true);

CREATE POLICY "workouts_insert_own" ON public.workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workouts_update_own" ON public.workouts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workouts_delete_own" ON public.workouts
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4) RLS — WORKOUT_ENTRIES (write-own via workout padre / read-all)
--    No tiene user_id; ownership se valida contra el workout padre.
-- ----------------------------------------------------------------------------
ALTER TABLE public.workout_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_entries_select_read_all" ON public.workout_entries
  FOR SELECT USING (true);

CREATE POLICY "workout_entries_insert_own" ON public.workout_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "workout_entries_update_own" ON public.workout_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "workout_entries_delete_own" ON public.workout_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_id AND w.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 5) RLS — PROGRESS_PHOTOS (owner-only per ADR-005)
-- ----------------------------------------------------------------------------
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_photos_select_own" ON public.progress_photos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "progress_photos_insert_own" ON public.progress_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progress_photos_update_own" ON public.progress_photos
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progress_photos_delete_own" ON public.progress_photos
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6) RLS — ROUTINES / ROUTINE_DAYS / ROUTINE_EXERCISES / EXERCISES
--    (read-all, sin escritura desde clientes — seed data per ADR-003)
-- ----------------------------------------------------------------------------
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routines_select_read_all" ON public.routines
  FOR SELECT USING (true);

ALTER TABLE public.routine_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_days_select_read_all" ON public.routine_days
  FOR SELECT USING (true);

ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_exercises_select_read_all" ON public.routine_exercises
  FOR SELECT USING (true);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises_select_read_all" ON public.exercises
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- 7) RLS — NUTRITION_ENTRIES / NUTRITION_GOALS (owner-only per ADR-005)
-- ----------------------------------------------------------------------------
ALTER TABLE public.nutrition_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_entries_select_own" ON public.nutrition_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "nutrition_entries_insert_own" ON public.nutrition_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_entries_update_own" ON public.nutrition_entries
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_entries_delete_own" ON public.nutrition_entries
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_goals_select_own" ON public.nutrition_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "nutrition_goals_insert_own" ON public.nutrition_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_goals_update_own" ON public.nutrition_goals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_goals_delete_own" ON public.nutrition_goals
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8) RLS — STORAGE.OBJECTS (bucket privado `progress-photos`, owner-only)
--    El bucket y el adapter de upload se crean en 6.3; la política queda lista.
--    NOTA: storage.objects.owner_id es TEXT en esta versión de Supabase;
--    auth.uid() devuelve UUID → se compara con cast a text.
-- ----------------------------------------------------------------------------
CREATE POLICY "progress_photos_storage_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'progress-photos' AND auth.uid()::text = owner_id
  );

CREATE POLICY "progress_photos_storage_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'progress-photos' AND auth.uid()::text = owner_id
  );

CREATE POLICY "progress_photos_storage_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'progress-photos' AND auth.uid()::text = owner_id
  ) WITH CHECK (
    bucket_id = 'progress-photos' AND auth.uid()::text = owner_id
  );

CREATE POLICY "progress_photos_storage_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'progress-photos' AND auth.uid()::text = owner_id
  );

-- ----------------------------------------------------------------------------
-- 9) RPC — GET_PROFILE_BY_EMAIL (SECURITY DEFINER)
--    public.profiles no tiene email (vive en auth.users). Este RPC permite a
--    ProfileRepository.findByEmail cumplir su contrato en Supabase.
--    Devuelve solo campos no sensibles del perfil.
-- ----------------------------------------------------------------------------
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