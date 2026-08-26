// tests/supabase/rls-photo.integration.test.ts
//
// AC-6.2-03: RLS en progress_photos enforce owner-only per ADR-005.
//   - Non-owner NO puede leer la fila de foto ajena.
//   - Non-owner NO puede borrar la fila de foto ajena.
//
// GATE: se ejecuta SOLO si hay credenciales Supabase válidas Y
// RUN_SUPABASE_INTEGRATION=true. Requiere la migración 002 aplicada.

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

describe.skipIf(!enabled)('RLS — progress_photos (AC-6.2-03)', () => {
  let owner: SupabaseClient;
  let nonOwner: SupabaseClient;
  let ownerId: string;
  let photoId: string;

  beforeAll(async () => {
    owner = createClient(url!, anonKey!);
    nonOwner = createClient(url!, anonKey!);

    const ownerUser = await ensureUser(owner, ownerEmail, password, {
      display_name: 'RLS Photo Owner',
      routine_type: 'hombre',
      weight_unit: 'kg',
    });
    ownerId = ownerUser.id;

    await ensureUser(nonOwner, nonOwnerEmail, password, {
      display_name: 'RLS Photo NonOwner',
      routine_type: 'mujer',
      weight_unit: 'kg',
    });
  });

  it('owner crea una fila de foto', async () => {
    const { data, error } = await owner
      .from('progress_photos')
      .insert({
        user_id: ownerId,
        storage_path: `${ownerId}/${Date.now()}.jpg`,
        photo_date: todayKey,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    photoId = data!.id;
  });

  it('non-owner NO puede leer la fila de foto ajena (owner-only per ADR-005)', async () => {
    const { data, error } = await nonOwner
      .from('progress_photos')
      .select('id')
      .eq('id', photoId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('non-owner NO puede borrar la fila de foto ajena', async () => {
    const { error } = await nonOwner
      .from('progress_photos')
      .delete()
      .eq('id', photoId);
    expect(error).toBeNull();

    const { data: verify } = await owner
      .from('progress_photos')
      .select('id')
      .eq('id', photoId);
    expect(verify).toHaveLength(1);
  });

  afterAll(async () => {
    if (photoId) {
      await owner.from('progress_photos').delete().eq('id', photoId);
    }
  });
});