// tests/supabase/integration-helpers.ts
//
// Helpers compartidos para los tests de integración RLS (story 6.2).
//
// `ensureUser` usa emails FIJOS + sign-in primero: si el usuario ya existe
// (de una corrida previa), se inicia sesión sin crear nada — evita presión
// sobre el rate limit de signUp de Supabase. Solo la PRIMERA corrida crea
// los usuarios (requiere que el rate limit esté disponible).

import type { SupabaseClient, User } from '@supabase/supabase-js';

export async function ensureUser(
  client: SupabaseClient,
  email: string,
  password: string,
  metadata: Record<string, string>,
): Promise<User> {
  // 1) Intentar sign-in primero (el usuario puede existir de una corrida previa).
  const { data: signInData, error: signInError } =
    await client.auth.signInWithPassword({ email, password });
  if (!signInError && signInData.session) {
    client.auth.setSession(signInData.session);
    return signInData.user;
  }

  // 2) No existe → signUp (primera corrida; sujeto al rate limit de Supabase).
  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (signUpError) {
    throw new Error(`signUp ${email} failed: ${signUpError.message}`);
  }
  if (!signUpData.user) {
    throw new Error(`signUp ${email} returned no user`);
  }

  // 3) Iniciar sesión tras el signUp.
  const { data: sessionData, error: sessionError } =
    await client.auth.signInWithPassword({ email, password });
  if (sessionError || !sessionData.session) {
    throw new Error(
      `signIn after signUp ${email} failed: ${sessionError?.message ?? 'no session'}`,
    );
  }
  client.auth.setSession(sessionData.session);
  return signUpData.user;
}