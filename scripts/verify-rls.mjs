// scripts/verify-rls.mjs
//
// Verificación end-to-end de RLS (story 6.2) usando los usuarios de prueba
// creados vía SQL (scripts/create-rls-test-users.sql). Evita el rate limit
// de signUp. Requiere credenciales válidas en .env.
//
// Verifica:
//   AC-6.2-02: workouts — non-owner SÍ lee (read-all), NO escribe (write-own)
//   AC-6.2-03: progress_photos — non-owner NO lee ni borra (owner-only)

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Cargar .env
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!(k in process.env)) process.env[k] = t.slice(eq + 1).trim();
  }
}

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('Faltan SUPABASE_URL/SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const PASSWORD = 'TestPass-2026!';
const OWNER_EMAIL = 'rls-sql-owner@example.com';
const NONOWNER_EMAIL = 'rls-sql-nonowner@example.com';
const todayKey = new Date().toISOString().split('T')[0];

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.error(`  ❌ ${name} ${detail}`);
  }
}

async function signIn(email) {
  const client = createClient(url, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`signIn ${email} falló: ${error?.message ?? 'no session'}`);
  client.auth.setSession(data.session);
  return client;
}

async function main() {
  console.log('=== RLS workouts (AC-6.2-02) ===');
  const owner = await signIn(OWNER_EMAIL);
  const nonOwner = await signIn(NONOWNER_EMAIL);

  // Owner crea un workout
  const { data: routineDay } = await owner.from('routine_days').select('id').limit(1).single();
  const { data: workout, error: wErr } = await owner
    .from('workouts')
    .insert({ user_id: (await owner.auth.getUser()).data.user.id, routine_day_id: routineDay.id, workout_date: todayKey })
    .select('id, status')
    .single();
  check('owner crea workout', !wErr && workout, wErr?.message ?? '');
  const workoutId = workout?.id;

  // Non-owner lee (read-all)
  const { data: readData, error: readErr } = await nonOwner.from('workouts').select('id').eq('id', workoutId);
  check('non-owner SÍ lee (read-all)', !readErr && readData?.length === 1, readErr?.message ?? '');

  // Non-owner intenta update (write-own)
  const { data: updData, error: updErr } = await nonOwner.from('workouts').update({ status: 'completed' }).eq('id', workoutId).select('id');
  check('non-owner NO actualiza (write-own)', !updErr && updData?.length === 0, updErr?.message ?? '');
  const { data: verifyStatus } = await owner.from('workouts').select('status').eq('id', workoutId).single();
  check('workout intacto tras update ajeno', verifyStatus?.status === 'in_progress');

  // Non-owner intenta delete
  const { error: delErr } = await nonOwner.from('workouts').delete().eq('id', workoutId);
  const { data: verifyExists } = await owner.from('workouts').select('id').eq('id', workoutId);
  check('non-owner NO borra (write-own)', !delErr && verifyExists?.length === 1, delErr?.message ?? '');

  // Cleanup workout
  await owner.from('workouts').delete().eq('id', workoutId);

  console.log('=== RLS progress_photos (AC-6.2-03) ===');
  const ownerId = (await owner.auth.getUser()).data.user.id;
  const { data: photo, error: pErr } = await owner
    .from('progress_photos')
    .insert({ user_id: ownerId, storage_path: `${ownerId}/${Date.now()}.jpg`, photo_date: todayKey })
    .select('id')
    .single();
  check('owner crea foto', !pErr && photo, pErr?.message ?? '');
  const photoId = photo?.id;

  // Non-owner lee (owner-only)
  const { data: pRead, error: pReadErr } = await nonOwner.from('progress_photos').select('id').eq('id', photoId);
  check('non-owner NO lee foto (owner-only)', !pReadErr && pRead?.length === 0, pReadErr?.message ?? '');

  // Non-owner borra (owner-only)
  const { error: pDelErr } = await nonOwner.from('progress_photos').delete().eq('id', photoId);
  const { data: pVerify } = await owner.from('progress_photos').select('id').eq('id', photoId);
  check('non-owner NO borra foto (owner-only)', !pDelErr && pVerify?.length === 1, pDelErr?.message ?? '');

  // Cleanup foto
  await owner.from('progress_photos').delete().eq('id', photoId);

  console.log(failures === 0 ? '\n✅ RLS VERIFICADO — 0 fallos' : `\n❌ ${failures} fallo(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});