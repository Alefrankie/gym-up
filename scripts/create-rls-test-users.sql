-- Creación de usuarios de prueba para verificar RLS (story 6.2)
-- Se insertan directo en auth.users (el trigger handle_new_user crea profiles).
-- Contraseña: TestPass-2026!
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES
(
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated',
  'rls-sql-owner@example.com',
  crypt('TestPass-2026!', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  '{"display_name":"SQL Owner","routine_type":"hombre","weight_unit":"kg"}',
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222',
  'authenticated', 'authenticated',
  'rls-sql-nonowner@example.com',
  crypt('TestPass-2026!', gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}',
  '{"display_name":"SQL NonOwner","routine_type":"mujer","weight_unit":"kg"}',
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;