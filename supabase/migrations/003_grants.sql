-- ============================================================================
-- Gym-Up — 003_grants.sql (Story 6.2 · Supabase)
-- ============================================================================
-- Las tablas creadas por migración NO reciben grants DML automáticos en
-- Supabase (solo TRUNCATE/REFERENCES/TRIGGER por defecto). Sin SELECT/INSERT/
-- UPDATE/DELETE, las políticas RLS son inútiles (permission denied 42501).
--
-- Se otorgan DML al rol `authenticated`; RLS restringe a nivel de fila
-- (write-own / read-all / owner-only per ADR-004/005).
-- `anon` NO recibe acceso a tablas (app privada tras login); el RPC
-- get_profile_by_email ya tiene GRANT EXECUTE para anon (login flow 6.3).
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_goals TO authenticated;