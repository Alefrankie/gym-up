// tests/supabase/rls-workout.integration.test.ts
//
// AC-6.2-02 (interpretación aprobada: read-all correcto): RLS en workouts
// enforce write-own / read-all per ADR-004.
//   - Non-owner SÍ puede leer el workout ajeno (read-all — feature familia).
//   - Non-owner NO puede escribir (update/delete) en el workout ajeno.
//
// GATE: se ejecuta SOLO si hay credenciales Supabase válidas Y
// RUN_SUPABASE_INTEGRATION=true (evita crear usuarios de prueba en prod
// accidentalmente). Requiere la migración 002 aplicada al remoto.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadDotEnvIfPresent } from '@/lib/env';
import { ensureUser } from './integration-helpers';

// Carga .env (vitest no lo hace automáticamente) para leer las credenciales.
loadDotEnvIfPresent();

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const enabled =
  Boolean(url && anonKey) && process.env.RUN_SUPABASE_INTEGRATION === 'true';

// Usuarios fijos creados vía scripts/create-rls-test-users.sql (evita el
// rate limit de signUp). ensureUser hace sign-in primero; si no existen,
// intenta signUp (sujeto a rate limit) — correr el script SQL es lo robusto.
const ownerEmail = 'rls-sql-owner@example.com';
const nonOwnerEmail = 'rls-sql-nonowner@example.com';
const password = 'TestPass-2026!';
const todayKey = new Date().toISOString().split('T')[0];

describe.skipIf(!enabled)('RLS — workouts (AC-6.2-02)', () => {
  let owner: SupabaseClient;
  let nonOwner: SupabaseClient;
  let ownerId: string;
  let routineDayId: string;
  let workoutId: string;

  beforeAll(async () => {
    owner = createClient(url!, anonKey!);
    nonOwner = createClient(url!, anonKey!);

    const ownerUser = await ensureUser(owner, ownerEmail, password, {
      display_name: 'RLS Owner',
      routine_type: 'hombre',
      weight_unit: 'kg',
    });
    ownerId = ownerUser.id;

    await ensureUser(nonOwner, nonOwnerEmail, password, {
      display_name: 'RLS NonOwner',
      routine_type: 'mujer',
      weight_unit: 'kg',
    });

    // Tomar un routine_day_id válido del seed.
    const { data: routineDay, error: routineDayError } = await owner
      .from('routine_days')
      .select('id')
      .limit(1)
      .single();
    if (routineDayError || !routineDay) {
      throw new Error(`Failed to fetch routine_day: ${routineDayError?.message ?? 'none'}`);
    }
    routineDayId = routineDay.id;
  });

  it('owner crea un workout', async () => {
    const { data, error } = await owner
      .from('workouts')
      .insert({
        user_id: ownerId,
        routine_day_id: routineDayId,
        workout_date: todayKey,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    workoutId = data!.id;
  });

  it('non-owner SÍ puede leer el workout ajeno (read-all per ADR-004)', async () => {
    const { data, error } = await nonOwner
      .from('workouts')
      .select('id')
      .eq('id', workoutId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(workoutId);
  });

  it('non-owner NO puede actualizar el workout ajeno (write-own per ADR-004)', async () => {
    const { data, error } = await nonOwner
      .from('workouts')
      .update({ status: 'completed' })
      .eq('id', workoutId)
      .select('id');
    // RLS: el UPDATE no matchea filas → data vacío, sin error.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    // El workout sigue intacto (verificado por el owner).
    const { data: verify } = await owner
      .from('workouts')
      .select('status')
      .eq('id', workoutId)
      .single();
    expect(verify!.status).toBe('in_progress');
  });

  it('non-owner NO puede borrar el workout ajeno', async () => {
    const { error } = await nonOwner.from('workouts').delete().eq('id', workoutId);
    expect(error).toBeNull();

    const { data: verify } = await owner
      .from('workouts')
      .select('id')
      .eq('id', workoutId);
    expect(verify).toHaveLength(1);
  });

  afterAll(async () => {
    // Cleanup: el owner borra su propio workout. Los usuarios de prueba
    // quedan en auth.users (no hay service_role key para borrarlos).
    if (workoutId) {
      await owner.from('workouts').delete().eq('id', workoutId);
    }
  });
});