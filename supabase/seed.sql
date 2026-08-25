-- ============================================================================
-- Gym-Up — Seed data (Story 6.1 · Supabase)
-- ============================================================================
-- Generado a partir de local.db (Round 1 / SQLite) para poblar el proyecto
-- remoto de Supabase. Formato PostgreSQL: `public.` + comillas simples.
--
-- Mapeo SQLite → Postgres:
--   * profiles (email/password_hash) → auth.users + trigger handle_new_user().
--     Se insertan los usuarios en auth.users (conservando id, email y hash
--     argon2id) y el trigger crea el perfil. Se incluye además un INSERT
--     explícito en public.profiles como respaldo (no-op si el trigger ya
--     creó el perfil).
--   * sessions → NO existe en Postgres (Supabase Auth gestiona sesiones).
--   * nutrition_entries / nutrition_goals → vacías en local.db, sin datos.
--   * timestamps unix (segundos/ms) → to_timestamp(...).
--
-- Idempotente: ON CONFLICT DO NOTHING en todos los INSERTs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUTH USERS (crea los perfiles vía trigger handle_new_user)
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'e255b5f2-fe7f-4f73-9cbb-cd1a724e94ea',
  'authenticated', 'authenticated',
  'arifre800@gmail.com',
  '$argon2id$v=19$m=65536,p=4,t=3$NimerX5wi5gksQHna70opg$XsVYf6dZ5y6kJdvbIb6PkAoKZnTagqTZZXKfHkPem3s',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"arian","routine_type":"hombre","weight_unit":"kg"}',
  to_timestamp(1785856977), now(),
  '', '', '', ''
) ON CONFLICT DO NOTHING;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'b3a2bcc9-a28c-4707-9fbf-b85b1800c47b',
  'authenticated', 'authenticated',
  'ariangarciaxs@gmail.com',
  '$argon2id$v=19$m=65536,p=4,t=3$+Ym/0itYnFh5h6/jltkddw$gZrsPS2Mmut+HXkdfa6/JSrsk4ivcHYI4nHwrlI71L0',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"arian","routine_type":"hombre","weight_unit":"kg"}',
  to_timestamp(1785861424), now(),
  '', '', '', ''
) ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. PROFILES (respaldo explícito; no-op si el trigger ya creó el perfil)
-- ----------------------------------------------------------------------------
INSERT INTO public.profiles (id, display_name, routine_type, weight_unit, created_at) VALUES
  ('e255b5f2-fe7f-4f73-9cbb-cd1a724e94ea', 'arian', 'hombre', 'kg', to_timestamp(1785856977)),
  ('b3a2bcc9-a28c-4707-9fbf-b85b1800c47b', 'arian', 'hombre', 'kg', to_timestamp(1785861424))
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. EXERCISES (32)
-- ----------------------------------------------------------------------------
INSERT INTO public.exercises (id, name, muscle_group) VALUES
  ('1af706ab-b3c6-46be-a289-027c74230e08', 'Bench Press', 'chest'),
  ('611091b2-4cac-4aec-9221-84540d2cc4d6', 'Incline Press', 'chest'),
  ('0fd31640-1cf8-4115-810f-f227798721c2', 'Incline Bench Press', 'chest'),
  ('39f58284-3f22-42cd-8220-eb45e3295820', 'Chest Press Machine', 'chest'),
  ('4ddc392d-e344-44c1-aec4-1773500ece29', 'Chest Press', 'chest'),
  ('7eb8aba1-a8b5-4b86-95ab-1bd41f0e8388', 'Pec Deck', 'chest'),
  ('6e656e5c-f2a5-4430-b68e-17cbbd9689c1', 'Cable Crossover', 'chest'),
  ('1074fb2b-5327-4975-a6ad-24db7ac00477', 'Shoulder Press', 'shoulders'),
  ('836ad113-b9a6-4e44-9eef-ba0b4162ed09', 'Lateral Raises', 'shoulders'),
  ('04144223-d383-4fe9-ac86-7c7de0cc24ed', 'Tricep Pulldown', 'triceps'),
  ('6ddc006c-ab29-4b26-bfc9-900413608690', 'Overhead Tricep Extension', 'triceps'),
  ('819876be-7f02-4fad-b344-28e8ec91059a', 'Tricep Extension', 'triceps'),
  ('5ef7cc73-3512-49dc-a4a4-9783ece0b906', 'Lat Pulldown', 'back'),
  ('d9750842-972c-4cff-9129-60bf34139742', 'Row', 'back'),
  ('5a333cb9-60e3-4892-ba2e-74d91c428399', 'Pullover', 'back'),
  ('5df53737-f969-4e10-a188-1a64b2783e1c', 'Seated Row', 'back'),
  ('2e51b3b8-cae7-4aba-b7ee-0ff1da993d82', 'Barbell Bicep Curl', 'biceps'),
  ('1b853487-b732-4a08-8dc9-70859df57ec4', 'Hammer Curl', 'biceps'),
  ('d0b0d639-9aa5-4113-b019-1c4ae8c874ea', 'Bicep Curl', 'biceps'),
  ('421bbbb7-9a28-40b7-8e31-dc866a75ddeb', 'Crunches', 'core'),
  ('ac83a16a-a039-4bc0-aa71-449df4850277', 'Squat', 'quads'),
  ('61ad4e1b-132f-4fe1-a4a4-ff2f936e99f5', 'Leg Press', 'quads'),
  ('c2c57625-44f3-4272-b5d8-8f2b65ec1d7d', 'Leg Extension', 'quads'),
  ('b9fe2d90-cb95-4f53-85b3-d1efd6783592', 'Bulgarian Squat', 'quads'),
  ('9465e06c-1475-4be8-8300-759f4e28bb98', 'Adductors', 'legs'),
  ('79238c0f-8835-4d8f-8b60-1f844bcdeb76', 'Abductors', 'legs'),
  ('4496d2ca-152f-4c71-abf0-efa114779e5b', 'Calves', 'legs'),
  ('868975e3-d411-4863-8f18-c2c4a3397292', 'Lunges', 'legs'),
  ('b013d948-85c1-4c4e-b8e5-8f7c676eed44', 'Romanian Deadlift', 'hamstrings'),
  ('b386769b-131c-4248-9d68-6632f9fce1de', 'Leg Curl', 'hamstrings'),
  ('4316038a-43d2-4ca1-a3cf-8e1080db8db8', 'Hip Thrust', 'glutes'),
  ('187c9e4a-6700-4cd6-8099-eabf8c6d071c', 'Cable Kickback', 'glutes')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. ROUTINES (2)
-- ----------------------------------------------------------------------------
INSERT INTO public.routines (id, name, type) VALUES
  ('5ede65a8-f118-4536-9362-a7a2ad8aef15', 'Male Routine', 'hombre'),
  ('d15372cb-66e4-4a5b-9c8b-c4681afb5141', 'Female Routine', 'mujer')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. ROUTINE DAYS (10)
-- ----------------------------------------------------------------------------
INSERT INTO public.routine_days (id, routine_id, day_number, day_name, focus) VALUES
  ('31f0cfcd-a0ae-48a3-89f8-94bf9443c79a', '5ede65a8-f118-4536-9362-a7a2ad8aef15', 1, 'Monday', 'Chest + Shoulders + Triceps'),
  ('3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', '5ede65a8-f118-4536-9362-a7a2ad8aef15', 2, 'Tuesday', 'Back + Biceps'),
  ('83067419-0ba1-41fc-b12c-14aef8214f27', '5ede65a8-f118-4536-9362-a7a2ad8aef15', 3, 'Wednesday', 'Chest + Triceps + Biceps'),
  ('e878fc5f-b6ea-4d34-a4a0-099909bffd1c', '5ede65a8-f118-4536-9362-a7a2ad8aef15', 4, 'Thursday', 'Quads + Adductors'),
  ('b32060e7-3397-42e5-a8dd-6d225e0e2947', '5ede65a8-f118-4536-9362-a7a2ad8aef15', 5, 'Friday', 'Glutes + Hamstrings'),
  ('1ed754d8-1bb0-4caa-a868-d11663c09fab', 'd15372cb-66e4-4a5b-9c8b-c4681afb5141', 1, 'Monday', 'Glutes + Quads'),
  ('b74e3e02-bc8e-46e3-8293-3bb08f941026', 'd15372cb-66e4-4a5b-9c8b-c4681afb5141', 2, 'Tuesday', 'Back + Biceps'),
  ('7342eac0-98b7-4adc-8af4-a8d92a432e6d', 'd15372cb-66e4-4a5b-9c8b-c4681afb5141', 3, 'Wednesday', 'Glutes + Hamstrings'),
  ('68f950e0-1b24-4036-b2f3-c62dadb52fde', 'd15372cb-66e4-4a5b-9c8b-c4681afb5141', 4, 'Thursday', 'Chest + Shoulders + Triceps'),
  ('8282fb21-a7a3-4d3a-b843-b8a3aaa8738c', 'd15372cb-66e4-4a5b-9c8b-c4681afb5141', 5, 'Friday', 'Glutes + Legs')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. ROUTINE EXERCISES (56)
-- ----------------------------------------------------------------------------
INSERT INTO public.routine_exercises (id, routine_day_id, exercise_id, target_sets, target_reps, exercise_order) VALUES
  -- Hombre · Monday
  ('fdf1229f-cf20-4f6d-8079-045d60031c76', '31f0cfcd-a0ae-48a3-89f8-94bf9443c79a', '1af706ab-b3c6-46be-a289-027c74230e08', 4, 10, 1),
  ('7425cd13-e00d-4e53-a301-1e58c3128e62', '31f0cfcd-a0ae-48a3-89f8-94bf9443c79a', '611091b2-4cac-4aec-9221-84540d2cc4d6', 4, 10, 2),
  ('c7b4c6ec-222b-46ba-86b2-7b5a3619a5ff', '31f0cfcd-a0ae-48a3-89f8-94bf9443c79a', '7eb8aba1-a8b5-4b86-95ab-1bd41f0e8388', 4, 10, 3),
  ('8bc77dd5-0ca7-46ca-b27d-e15a6e737086', '31f0cfcd-a0ae-48a3-89f8-94bf9443c79a', '1074fb2b-5327-4975-a6ad-24db7ac00477', 4, 10, 4),
  ('4d76c7d7-db61-40ad-8558-787116d27a38', '31f0cfcd-a0ae-48a3-89f8-94bf9443c79a', '836ad113-b9a6-4e44-9eef-ba0b4162ed09', 4, 10, 5),
  ('7d103a55-764d-4ce8-a91d-e963d01dee74', '31f0cfcd-a0ae-48a3-89f8-94bf9443c79a', '04144223-d383-4fe9-ac86-7c7de0cc24ed', 4, 10, 6),
  ('9850e5d1-b3eb-425b-a157-ee136e46ff7b', '31f0cfcd-a0ae-48a3-89f8-94bf9443c79a', '6ddc006c-ab29-4b26-bfc9-900413608690', 4, 10, 7),
  -- Hombre · Tuesday
  ('88f4bc59-d3f6-42bd-9aa6-2c61f5d5a89c', '3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', '5ef7cc73-3512-49dc-a4a4-9783ece0b906', 4, 10, 1),
  ('1021da0a-669c-4997-9eac-bb2a814d7763', '3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', 'd9750842-972c-4cff-9129-60bf34139742', 4, 10, 2),
  ('73882b85-1d2b-4aa6-9b96-8e53c9f9c9a5', '3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', '5a333cb9-60e3-4892-ba2e-74d91c428399', 4, 10, 3),
  ('ba9f044e-bd74-4cf2-b74f-f544fd7290a8', '3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', '5df53737-f969-4e10-a188-1a64b2783e1c', 4, 10, 4),
  ('4d84fdba-a2cd-4be7-9edb-e1b7d6414afb', '3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', '2e51b3b8-cae7-4aba-b7ee-0ff1da993d82', 4, 10, 5),
  ('c1e65cbd-07b4-427c-b592-c54722049776', '3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', '1b853487-b732-4a08-8dc9-70859df57ec4', 4, 10, 6),
  ('5df54329-059b-4ed3-9c2c-eda8e260a2fa', '3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', '421bbbb7-9a28-40b7-8e31-dc866a75ddeb', 4, 10, 7),
  -- Hombre · Wednesday
  ('4dbe80a6-8c28-47f2-9777-bac90ba887c3', '83067419-0ba1-41fc-b12c-14aef8214f27', '0fd31640-1cf8-4115-810f-f227798721c2', 4, 10, 1),
  ('fa45c4df-bd1e-4b84-a59d-23182a2ccf5d', '83067419-0ba1-41fc-b12c-14aef8214f27', '39f58284-3f22-42cd-8220-eb45e3295820', 4, 10, 2),
  ('63d59dd8-00d0-4e13-b4cc-a76ba5f768f2', '83067419-0ba1-41fc-b12c-14aef8214f27', '6e656e5c-f2a5-4430-b68e-17cbbd9689c1', 4, 10, 3),
  ('4760c1d9-ccf1-46d6-b692-4843b2d5edad', '83067419-0ba1-41fc-b12c-14aef8214f27', '04144223-d383-4fe9-ac86-7c7de0cc24ed', 4, 10, 4),
  ('0de54b03-6546-4804-b213-11bd940a9a36', '83067419-0ba1-41fc-b12c-14aef8214f27', '819876be-7f02-4fad-b344-28e8ec91059a', 4, 10, 5),
  ('8f9ef88b-5e2d-4e3e-a38e-9bfca93d01bd', '83067419-0ba1-41fc-b12c-14aef8214f27', 'd0b0d639-9aa5-4113-b019-1c4ae8c874ea', 4, 10, 6),
  -- Hombre · Thursday
  ('a8397fe9-bb97-4069-b85d-acb4bbc2aec6', 'e878fc5f-b6ea-4d34-a4a0-099909bffd1c', 'ac83a16a-a039-4bc0-aa71-449df4850277', 4, 10, 1),
  ('e3d7d143-efc1-4e85-92c2-0683e75c66d8', 'e878fc5f-b6ea-4d34-a4a0-099909bffd1c', '61ad4e1b-132f-4fe1-a4a4-ff2f936e99f5', 4, 10, 2),
  ('b38c56a0-a79d-4e91-b3a1-4b73d6fd5e48', 'e878fc5f-b6ea-4d34-a4a0-099909bffd1c', 'c2c57625-44f3-4272-b5d8-8f2b65ec1d7d', 4, 10, 3),
  ('29b7dee4-6fea-4e9e-b72c-c6e5efdf53b9', 'e878fc5f-b6ea-4d34-a4a0-099909bffd1c', '9465e06c-1475-4be8-8300-759f4e28bb98', 4, 10, 4),
  ('448778e9-6ca6-42bd-b59a-5e34711119c1', 'e878fc5f-b6ea-4d34-a4a0-099909bffd1c', '4496d2ca-152f-4c71-abf0-efa114779e5b', 4, 10, 5),
  -- Hombre · Friday
  ('b08763df-60bf-4d4a-b9d0-86ea5eba6fb5', 'b32060e7-3397-42e5-a8dd-6d225e0e2947', 'b013d948-85c1-4c4e-b8e5-8f7c676eed44', 4, 10, 1),
  ('e32b2820-86cc-41e3-85dc-b7f545dcae40', 'b32060e7-3397-42e5-a8dd-6d225e0e2947', 'b386769b-131c-4248-9d68-6632f9fce1de', 4, 10, 2),
  ('9006db82-00a2-41ca-8ad2-75707e9ce2e0', 'b32060e7-3397-42e5-a8dd-6d225e0e2947', '4316038a-43d2-4ca1-a3cf-8e1080db8db8', 4, 10, 3),
  ('385662d0-e46c-4618-9b87-0806597cd969', 'b32060e7-3397-42e5-a8dd-6d225e0e2947', '868975e3-d411-4863-8f18-c2c4a3397292', 4, 10, 4),
  ('16e989d2-4a8d-4c3b-adc1-8ef65d2a00f4', 'b32060e7-3397-42e5-a8dd-6d225e0e2947', '4496d2ca-152f-4c71-abf0-efa114779e5b', 4, 10, 5),
  ('47fb2cbb-b108-4619-b3a9-9cb7662f8eb2', 'b32060e7-3397-42e5-a8dd-6d225e0e2947', '421bbbb7-9a28-40b7-8e31-dc866a75ddeb', 4, 10, 6),
  -- Mujer · Monday
  ('f70dcc23-a4dd-4317-8d7a-76d9bd960c32', '1ed754d8-1bb0-4caa-a868-d11663c09fab', '4316038a-43d2-4ca1-a3cf-8e1080db8db8', 4, 10, 1),
  ('16daedcd-342e-4a61-b91b-9c1717d0d98d', '1ed754d8-1bb0-4caa-a868-d11663c09fab', 'ac83a16a-a039-4bc0-aa71-449df4850277', 4, 10, 2),
  ('8aea63c3-6370-49f5-b1d4-8db0d89937b9', '1ed754d8-1bb0-4caa-a868-d11663c09fab', '61ad4e1b-132f-4fe1-a4a4-ff2f936e99f5', 4, 10, 3),
  ('0fff15d3-7734-4877-8533-61e7bc867776', '1ed754d8-1bb0-4caa-a868-d11663c09fab', 'c2c57625-44f3-4272-b5d8-8f2b65ec1d7d', 4, 10, 4),
  ('8e0ee421-5f56-404c-ace7-03c143073b5d', '1ed754d8-1bb0-4caa-a868-d11663c09fab', '79238c0f-8835-4d8f-8b60-1f844bcdeb76', 4, 10, 5),
  -- Mujer · Tuesday
  ('9f6d4b4b-a83d-447a-b4c3-db7f4270ae78', 'b74e3e02-bc8e-46e3-8293-3bb08f941026', '5ef7cc73-3512-49dc-a4a4-9783ece0b906', 4, 10, 1),
  ('ebad20ba-e733-4109-bca5-5aa7c9c721c8', 'b74e3e02-bc8e-46e3-8293-3bb08f941026', 'd9750842-972c-4cff-9129-60bf34139742', 4, 10, 2),
  ('46878023-0ee6-48d1-b78a-d71105358bff', 'b74e3e02-bc8e-46e3-8293-3bb08f941026', '5a333cb9-60e3-4892-ba2e-74d91c428399', 4, 10, 3),
  ('a78d0fa6-2e8b-4c3e-93f9-77d6c9cff799', 'b74e3e02-bc8e-46e3-8293-3bb08f941026', 'd0b0d639-9aa5-4113-b019-1c4ae8c874ea', 4, 10, 4),
  ('3479e667-a726-438d-84c5-0c03d24b44ac', 'b74e3e02-bc8e-46e3-8293-3bb08f941026', '421bbbb7-9a28-40b7-8e31-dc866a75ddeb', 4, 10, 5),
  -- Mujer · Wednesday
  ('66f46701-eda3-4aa1-ad34-388586881e7a', '7342eac0-98b7-4adc-8af4-a8d92a432e6d', 'b013d948-85c1-4c4e-b8e5-8f7c676eed44', 4, 10, 1),
  ('c7121249-90ac-4b56-8fcf-cdbb7f2be44b', '7342eac0-98b7-4adc-8af4-a8d92a432e6d', 'b386769b-131c-4248-9d68-6632f9fce1de', 4, 10, 2),
  ('d40d68e9-1d1e-4c03-ab93-0c80272b2248', '7342eac0-98b7-4adc-8af4-a8d92a432e6d', '4316038a-43d2-4ca1-a3cf-8e1080db8db8', 4, 10, 3),
  ('dd0c135b-2bf4-4092-9eb4-c35306b173d9', '7342eac0-98b7-4adc-8af4-a8d92a432e6d', '187c9e4a-6700-4cd6-8099-eabf8c6d071c', 4, 10, 4),
  ('cca88527-f61c-4c93-83cc-5f2ca4ab1ce4', '7342eac0-98b7-4adc-8af4-a8d92a432e6d', '79238c0f-8835-4d8f-8b60-1f844bcdeb76', 4, 10, 5),
  -- Mujer · Thursday
  ('87090610-3f07-496c-90ce-091d0a629e77', '68f950e0-1b24-4036-b2f3-c62dadb52fde', '4ddc392d-e344-44c1-aec4-1773500ece29', 4, 10, 1),
  ('8729d118-48cb-43b3-9935-66225379ca72', '68f950e0-1b24-4036-b2f3-c62dadb52fde', '1074fb2b-5327-4975-a6ad-24db7ac00477', 4, 10, 2),
  ('b630c6f6-2ba4-451b-818e-988875a33e62', '68f950e0-1b24-4036-b2f3-c62dadb52fde', '836ad113-b9a6-4e44-9eef-ba0b4162ed09', 4, 10, 3),
  ('e1f0b687-4f48-4399-b00b-8d86608b9402', '68f950e0-1b24-4036-b2f3-c62dadb52fde', '04144223-d383-4fe9-ac86-7c7de0cc24ed', 4, 10, 4),
  -- Mujer · Friday
  ('15b5471e-0ab7-4d74-9bcd-1aea6fe8376e', '8282fb21-a7a3-4d3a-b843-b8a3aaa8738c', '4316038a-43d2-4ca1-a3cf-8e1080db8db8', 4, 10, 1),
  ('38503c77-ce08-4f6e-8c4d-99e789997fa2', '8282fb21-a7a3-4d3a-b843-b8a3aaa8738c', 'b9fe2d90-cb95-4f53-85b3-d1efd6783592', 4, 10, 2),
  ('dbdde0cd-ab8f-4958-9881-167d1dc2a683', '8282fb21-a7a3-4d3a-b843-b8a3aaa8738c', '868975e3-d411-4863-8f18-c2c4a3397292', 4, 10, 3),
  ('38fcbd89-8344-4565-9a29-ed74dbd3bcb1', '8282fb21-a7a3-4d3a-b843-b8a3aaa8738c', '79238c0f-8835-4d8f-8b60-1f844bcdeb76', 4, 10, 4),
  ('386d30db-3578-4a6f-a48e-4070cc2d8a5c', '8282fb21-a7a3-4d3a-b843-b8a3aaa8738c', '4496d2ca-152f-4c71-abf0-efa114779e5b', 4, 10, 5),
  ('8a218df8-dfb2-4702-9b5d-a68459058d01', '8282fb21-a7a3-4d3a-b843-b8a3aaa8738c', '421bbbb7-9a28-40b7-8e31-dc866a75ddeb', 4, 10, 6)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. WORKOUTS (6)
-- ----------------------------------------------------------------------------
INSERT INTO public.workouts (id, user_id, routine_day_id, workout_date, status, started_at, completed_at) VALUES
  ('de3ab03d-f21c-4655-9ed3-aecc88dcf2b6', 'e255b5f2-fe7f-4f73-9cbb-cd1a724e94ea', '3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', to_timestamp(1785857090)::date, 'in_progress', to_timestamp(1785857090), NULL),
  ('f6a265c1-7225-4398-a43d-9d5387c2b607', 'b3a2bcc9-a28c-4707-9fbf-b85b1800c47b', '3a1a9c0c-279b-445b-b7e4-7fd5e2eab46a', to_timestamp(1785861529)::date, 'in_progress', to_timestamp(1785861529), NULL),
  ('fe1209b6-e623-4430-8a38-9ba096cf35de', 'b3a2bcc9-a28c-4707-9fbf-b85b1800c47b', '83067419-0ba1-41fc-b12c-14aef8214f27', to_timestamp(1785941177)::date, 'in_progress', to_timestamp(1785941177), NULL),
  ('54373892-62e4-4548-8bb0-342f23dc6570', 'b3a2bcc9-a28c-4707-9fbf-b85b1800c47b', 'b32060e7-3397-42e5-a8dd-6d225e0e2947', to_timestamp(1786057642)::date, 'in_progress', to_timestamp(1786057642), NULL),
  ('3b4d9db2-7f69-4508-9a60-253d9954652f', 'b3a2bcc9-a28c-4707-9fbf-b85b1800c47b', 'b32060e7-3397-42e5-a8dd-6d225e0e2947', to_timestamp(1786107590)::date, 'in_progress', to_timestamp(1786107590), NULL),
  ('ac205d95-4dfd-42cd-b5d9-85d2c2fffcba', 'b3a2bcc9-a28c-4707-9fbf-b85b1800c47b', 'e878fc5f-b6ea-4d34-a4a0-099909bffd1c', to_timestamp(1786573767)::date, 'in_progress', to_timestamp(1786573767), NULL)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. WORKOUT ENTRIES (5)
-- ----------------------------------------------------------------------------
INSERT INTO public.workout_entries (id, workout_id, exercise_id, set_number, reps, weight, completed, notes, created_at) VALUES
  ('b5633ae6-9e9c-4314-b2fc-644480ea3ecb', 'f6a265c1-7225-4398-a43d-9d5387c2b607', '5ef7cc73-3512-49dc-a4a4-9783ece0b906', 1, 15, 10, TRUE, NULL, to_timestamp(1785861552)),
  ('2c66056b-fd77-4d30-a8dc-a0de1539eba0', 'f6a265c1-7225-4398-a43d-9d5387c2b607', '5ef7cc73-3512-49dc-a4a4-9783ece0b906', 1, 15, 0, FALSE, NULL, to_timestamp(1785861552)),
  ('aab1621d-3ff4-4946-b839-9332d9ede2b3', '3b4d9db2-7f69-4508-9a60-253d9954652f', 'b013d948-85c1-4c4e-b8e5-8f7c676eed44', 1, 10, 15, TRUE, NULL, to_timestamp(1786109486)),
  ('016f96eb-a28c-477e-a4ab-3c796f2c4c1c', '3b4d9db2-7f69-4508-9a60-253d9954652f', 'b013d948-85c1-4c4e-b8e5-8f7c676eed44', 2, 10, 15, TRUE, NULL, to_timestamp(1786109506)),
  ('1443467e-d4c8-4e60-9791-3ff7d4cd20ce', '3b4d9db2-7f69-4508-9a60-253d9954652f', 'b013d948-85c1-4c4e-b8e5-8f7c676eed44', 4, 10, 15, TRUE, NULL, to_timestamp(1786109521))
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9. PROGRESS PHOTOS (1)
-- ----------------------------------------------------------------------------
INSERT INTO public.progress_photos (id, user_id, storage_path, photo_date, caption, created_at) VALUES
  ('d394db00-4946-4db7-9e32-0a58cc004c38', 'b3a2bcc9-a28c-4707-9fbf-b85b1800c47b', 'b3a2bcc9-a28c-4707-9fbf-b85b1800c47b\1786394242581.png', to_timestamp(1786394242)::date, NULL, to_timestamp(1786394242))
ON CONFLICT DO NOTHING;