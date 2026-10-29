-- Phase 2: exercise library (ADR-017) and user-owned programs (ADR-018).
-- Columns are added with ALTER TABLE ADD COLUMN: SQLite cannot relax NOT NULL or UNIQUE without a table rebuild,
-- so `routines.type` stays NOT NULL and exercise names stay globally unique (custom names are unique across the family).

ALTER TABLE `exercises` ADD COLUMN `secondary_muscles` text NOT NULL DEFAULT '[]';
ALTER TABLE `exercises` ADD COLUMN `equipment` text NOT NULL DEFAULT 'other';
ALTER TABLE `exercises` ADD COLUMN `exercise_type` text NOT NULL DEFAULT 'weight_reps';
ALTER TABLE `exercises` ADD COLUMN `instructions` text;
ALTER TABLE `exercises` ADD COLUMN `video_url` text;
ALTER TABLE `exercises` ADD COLUMN `owner_id` text REFERENCES `profiles`(`id`) ON DELETE SET NULL;
ALTER TABLE `exercises` ADD COLUMN `is_archived` integer NOT NULL DEFAULT 0;
ALTER TABLE `exercises` ADD COLUMN `created_at` integer NOT NULL DEFAULT 0;
CREATE INDEX `exercises_owner_idx` ON `exercises` (`owner_id`);

ALTER TABLE `routines` ADD COLUMN `owner_id` text REFERENCES `profiles`(`id`) ON DELETE CASCADE;
ALTER TABLE `routines` ADD COLUMN `source_template_id` text;
ALTER TABLE `routines` ADD COLUMN `description` text;
ALTER TABLE `routines` ADD COLUMN `is_template` integer NOT NULL DEFAULT 0;
ALTER TABLE `routines` ADD COLUMN `level` text;
ALTER TABLE `routines` ADD COLUMN `goal` text;
ALTER TABLE `routines` ADD COLUMN `days_per_week` integer;
ALTER TABLE `routines` ADD COLUMN `is_archived` integer NOT NULL DEFAULT 0;
ALTER TABLE `routines` ADD COLUMN `created_at` integer NOT NULL DEFAULT 0;
ALTER TABLE `routines` ADD COLUMN `updated_at` integer NOT NULL DEFAULT 0;
CREATE INDEX `routines_owner_idx` ON `routines` (`owner_id`);

ALTER TABLE `routine_days` ADD COLUMN `notes` text;

ALTER TABLE `routine_exercises` ADD COLUMN `target_reps_min` integer;
ALTER TABLE `routine_exercises` ADD COLUMN `target_reps_max` integer;
ALTER TABLE `routine_exercises` ADD COLUMN `warmup_sets` integer NOT NULL DEFAULT 0;
ALTER TABLE `routine_exercises` ADD COLUMN `rest_seconds` integer;
ALTER TABLE `routine_exercises` ADD COLUMN `notes` text;

ALTER TABLE `profiles` ADD COLUMN `active_program_id` text REFERENCES `routines`(`id`) ON DELETE SET NULL;

-- The two Phase 1 routines become seeded templates.
UPDATE `routines` SET `is_template` = 1, `name` = 'Male 5-Day Split', `description` = 'Cinco días: pecho y hombros, espalda, brazos, piernas y glúteos.', `level` = 'intermediate', `goal` = 'hypertrophy', `days_per_week` = 5 WHERE `type` = 'hombre' AND `owner_id` IS NULL;
UPDATE `routines` SET `is_template` = 1, `name` = 'Female Glute Focus 5-Day', `description` = 'Cinco días con énfasis en glúteos y piernas.', `level` = 'intermediate', `goal` = 'hypertrophy', `days_per_week` = 5 WHERE `type` = 'mujer' AND `owner_id` IS NULL;
UPDATE `routine_exercises` SET `target_reps_min` = `target_reps`, `target_reps_max` = `target_reps` WHERE `target_reps_min` IS NULL;

-- Catalog data for the 32 Phase 1 exercises (muscle taxonomy, equipment, type, instructions).

UPDATE `exercises` SET `muscle_group` = 'chest', `secondary_muscles` = '["triceps", "shoulders"]', `equipment` = 'barbell', `exercise_type` = 'weight_reps', `instructions` = '1. Acuéstate en el banco con los pies firmes en el suelo y los omóplatos juntos.
2. Baja la barra de forma controlada hasta rozar la mitad del pecho.
3. Empuja hacia arriba hasta extender los codos sin bloquearlos.' WHERE `name` = 'Bench Press';
UPDATE `exercises` SET `muscle_group` = 'chest', `secondary_muscles` = '["shoulders", "triceps"]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. Ajusta el banco a unos 30 grados y siéntate con la espalda apoyada.
2. Baja las mancuernas hasta la parte alta del pecho.
3. Empuja hacia arriba juntando ligeramente las mancuernas.' WHERE `name` = 'Incline Press';
UPDATE `exercises` SET `muscle_group` = 'chest', `secondary_muscles` = '["shoulders", "triceps"]', `equipment` = 'barbell', `exercise_type` = 'weight_reps', `instructions` = '1. Ajusta el banco a unos 30 grados y agarra la barra algo más ancho que los hombros.
2. Baja la barra hasta la parte alta del pecho de forma controlada.
3. Empuja hasta extender los brazos sin despegar la espalda del banco.' WHERE `name` = 'Incline Bench Press';
UPDATE `exercises` SET `muscle_group` = 'chest', `secondary_muscles` = '["triceps"]', `equipment` = 'machine', `exercise_type` = 'weight_reps', `instructions` = '1. Ajusta el asiento para que las asas queden a la altura del pecho.
2. Empuja las asas hacia delante hasta casi extender los brazos.
3. Vuelve despacio hasta sentir el estiramiento del pecho.' WHERE `name` = 'Chest Press Machine';
UPDATE `exercises` SET `muscle_group` = 'chest', `secondary_muscles` = '["triceps"]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. Acuéstate en el banco con una mancuerna en cada mano a la altura del pecho.
2. Empuja hacia arriba hasta extender los brazos.
3. Baja de forma controlada hasta que los codos queden a la altura del banco.' WHERE `name` = 'Chest Press';
UPDATE `exercises` SET `muscle_group` = 'chest', `secondary_muscles` = '["shoulders"]', `equipment` = 'machine', `exercise_type` = 'weight_reps', `instructions` = '1. Siéntate con la espalda apoyada y los antebrazos sobre las almohadillas.
2. Junta los brazos delante del pecho apretando el pecho.
3. Vuelve despacio sin dejar que las pesas se apoyen.' WHERE `name` = 'Pec Deck';
UPDATE `exercises` SET `muscle_group` = 'chest', `secondary_muscles` = '[]', `equipment` = 'cable', `exercise_type` = 'weight_reps', `instructions` = '1. Coloca las poleas altas y da un paso al frente.
2. Lleva las manos hacia abajo y al centro, cruzándolas frente al abdomen.
3. Vuelve controlando la tensión hasta abrir el pecho.' WHERE `name` = 'Cable Crossover';
UPDATE `exercises` SET `muscle_group` = 'shoulders', `secondary_muscles` = '["triceps"]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. Siéntate con la espalda recta y las mancuernas a la altura de los hombros.
2. Empuja hacia arriba hasta casi extender los brazos.
3. Baja de forma controlada hasta la altura de las orejas.' WHERE `name` = 'Shoulder Press';
UPDATE `exercises` SET `muscle_group` = 'shoulders', `secondary_muscles` = '[]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. De pie, con una mancuerna en cada mano y los codos ligeramente flexionados.
2. Eleva los brazos hacia los lados hasta la altura de los hombros.
3. Baja despacio sin balancear el torso.' WHERE `name` = 'Lateral Raises';
UPDATE `exercises` SET `muscle_group` = 'triceps', `secondary_muscles` = '[]', `equipment` = 'cable', `exercise_type` = 'weight_reps', `instructions` = '1. Agarra la barra o la cuerda de la polea alta con los codos pegados al cuerpo.
2. Extiende los codos hacia abajo hasta contraer el tríceps.
3. Sube controlando hasta que los antebrazos queden a unos 90 grados.' WHERE `name` = 'Tricep Pulldown';
UPDATE `exercises` SET `muscle_group` = 'triceps', `secondary_muscles` = '[]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. Sostén una mancuerna con ambas manos detrás de la cabeza.
2. Extiende los codos hacia arriba sin abrirlos.
3. Baja despacio hasta sentir el estiramiento del tríceps.' WHERE `name` = 'Overhead Tricep Extension';
UPDATE `exercises` SET `muscle_group` = 'triceps', `secondary_muscles` = '[]', `equipment` = 'cable', `exercise_type` = 'weight_reps', `instructions` = '1. De espaldas a la polea baja, sostén la cuerda con los codos cerca de la cabeza.
2. Extiende los brazos hacia delante y arriba.
3. Vuelve de forma controlada sin mover los codos.' WHERE `name` = 'Tricep Extension';
UPDATE `exercises` SET `muscle_group` = 'lats', `secondary_muscles` = '["biceps"]', `equipment` = 'cable', `exercise_type` = 'weight_reps', `instructions` = '1. Siéntate agarrando la barra más ancho que los hombros, con el pecho alto.
2. Tira de la barra hacia la parte alta del pecho llevando los codos hacia abajo.
3. Sube despacio hasta extender los brazos.' WHERE `name` = 'Lat Pulldown';
UPDATE `exercises` SET `muscle_group` = 'upper_back', `secondary_muscles` = '["lats", "biceps"]', `equipment` = 'barbell', `exercise_type` = 'weight_reps', `instructions` = '1. Inclinado hacia delante con la espalda recta, agarra la barra a la altura de las rodillas.
2. Tira de la barra hacia el abdomen juntando los omóplatos.
3. Baja de forma controlada sin redondear la espalda.' WHERE `name` = 'Row';
UPDATE `exercises` SET `muscle_group` = 'lats', `secondary_muscles` = '["chest"]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. Acuéstate cruzado en el banco sosteniendo una mancuerna sobre el pecho.
2. Baja la mancuerna detrás de la cabeza con los brazos casi rectos.
3. Vuelve al punto de partida usando los dorsales.' WHERE `name` = 'Pullover';
UPDATE `exercises` SET `muscle_group` = 'upper_back', `secondary_muscles` = '["lats", "biceps"]', `equipment` = 'cable', `exercise_type` = 'weight_reps', `instructions` = '1. Siéntate con los pies en las plataformas y la espalda recta.
2. Tira del agarre hacia el abdomen juntando los omóplatos.
3. Vuelve despacio hasta extender los brazos sin encorvarte.' WHERE `name` = 'Seated Row';
UPDATE `exercises` SET `muscle_group` = 'biceps', `secondary_muscles` = '["forearms"]', `equipment` = 'barbell', `exercise_type` = 'weight_reps', `instructions` = '1. De pie, agarra la barra con las palmas hacia arriba y los codos pegados al torso.
2. Flexiona los codos llevando la barra hacia los hombros.
3. Baja de forma controlada hasta extender los brazos.' WHERE `name` = 'Barbell Bicep Curl';
UPDATE `exercises` SET `muscle_group` = 'biceps', `secondary_muscles` = '["forearms"]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. De pie, sostén las mancuernas con las palmas enfrentadas.
2. Flexiona los codos sin girar las muñecas.
3. Baja despacio hasta extender los brazos.' WHERE `name` = 'Hammer Curl';
UPDATE `exercises` SET `muscle_group` = 'biceps', `secondary_muscles` = '[]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. De pie, con una mancuerna en cada mano y las palmas hacia delante.
2. Flexiona los codos llevando las mancuernas hacia los hombros.
3. Baja de forma controlada sin balancear el cuerpo.' WHERE `name` = 'Bicep Curl';
UPDATE `exercises` SET `muscle_group` = 'abdominals', `secondary_muscles` = '[]', `equipment` = 'bodyweight', `exercise_type` = 'bodyweight_reps', `instructions` = '1. Acuéstate boca arriba con las rodillas flexionadas y las manos junto a la cabeza.
2. Eleva los hombros del suelo contrayendo el abdomen.
3. Baja despacio sin tirar del cuello.' WHERE `name` = 'Crunches';
UPDATE `exercises` SET `muscle_group` = 'quadriceps', `secondary_muscles` = '["glutes", "hamstrings"]', `equipment` = 'barbell', `exercise_type` = 'weight_reps', `instructions` = '1. Coloca la barra sobre la parte alta de la espalda y separa los pies al ancho de los hombros.
2. Baja flexionando cadera y rodillas hasta que los muslos queden paralelos al suelo.
3. Empuja con los talones para subir manteniendo la espalda recta.' WHERE `name` = 'Squat';
UPDATE `exercises` SET `muscle_group` = 'quadriceps', `secondary_muscles` = '["glutes"]', `equipment` = 'machine', `exercise_type` = 'weight_reps', `instructions` = '1. Siéntate con la espalda apoyada y los pies a la anchura de los hombros.
2. Baja la plataforma hasta que las rodillas formen unos 90 grados.
3. Empuja hasta casi extender las piernas sin bloquear las rodillas.' WHERE `name` = 'Leg Press';
UPDATE `exercises` SET `muscle_group` = 'quadriceps', `secondary_muscles` = '[]', `equipment` = 'machine', `exercise_type` = 'weight_reps', `instructions` = '1. Siéntate con la espalda apoyada y el rodillo sobre los tobillos.
2. Extiende las rodillas hasta elevar las piernas.
3. Baja despacio sin dejar caer el peso.' WHERE `name` = 'Leg Extension';
UPDATE `exercises` SET `muscle_group` = 'quadriceps', `secondary_muscles` = '["glutes"]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. Apoya el pie de atrás sobre un banco y sostén una mancuerna en cada mano.
2. Baja flexionando la rodilla delantera hasta que el muslo quede paralelo al suelo.
3. Empuja con el talón de delante para subir.' WHERE `name` = 'Bulgarian Squat';
UPDATE `exercises` SET `muscle_group` = 'adductors', `secondary_muscles` = '[]', `equipment` = 'machine', `exercise_type` = 'weight_reps', `instructions` = '1. Siéntate en la máquina con las piernas abiertas sobre las almohadillas.
2. Junta las piernas apretando la parte interna del muslo.
3. Vuelve despacio sin soltar el peso de golpe.' WHERE `name` = 'Adductors';
UPDATE `exercises` SET `muscle_group` = 'abductors', `secondary_muscles` = '["glutes"]', `equipment` = 'machine', `exercise_type` = 'weight_reps', `instructions` = '1. Siéntate en la máquina con las piernas juntas contra las almohadillas.
2. Abre las piernas hacia fuera empujando con los glúteos.
3. Vuelve de forma controlada hasta juntarlas.' WHERE `name` = 'Abductors';
UPDATE `exercises` SET `muscle_group` = 'calves', `secondary_muscles` = '[]', `equipment` = 'machine', `exercise_type` = 'weight_reps', `instructions` = '1. Apoya la punta de los pies en la plataforma con los talones fuera.
2. Eleva los talones lo más alto posible.
3. Baja despacio hasta sentir el estiramiento de la pantorrilla.' WHERE `name` = 'Calves';
UPDATE `exercises` SET `muscle_group` = 'quadriceps', `secondary_muscles` = '["glutes"]', `equipment` = 'dumbbell', `exercise_type` = 'weight_reps', `instructions` = '1. De pie, con una mancuerna en cada mano, da un paso largo hacia delante.
2. Baja la rodilla de atrás casi hasta el suelo.
3. Empuja con la pierna de delante para volver al inicio.' WHERE `name` = 'Lunges';
UPDATE `exercises` SET `muscle_group` = 'hamstrings', `secondary_muscles` = '["glutes", "lower_back"]', `equipment` = 'barbell', `exercise_type` = 'weight_reps', `instructions` = '1. De pie, sostén la barra frente a los muslos con las rodillas ligeramente flexionadas.
2. Lleva la cadera hacia atrás bajando la barra pegada a las piernas, con la espalda recta.
3. Sube empujando la cadera hacia delante hasta quedar de pie.' WHERE `name` = 'Romanian Deadlift';
UPDATE `exercises` SET `muscle_group` = 'hamstrings', `secondary_muscles` = '[]', `equipment` = 'machine', `exercise_type` = 'weight_reps', `instructions` = '1. Ajusta la máquina para que el rodillo quede sobre los tobillos.
2. Flexiona las rodillas llevando los talones hacia los glúteos.
3. Vuelve despacio hasta extender las piernas.' WHERE `name` = 'Leg Curl';
UPDATE `exercises` SET `muscle_group` = 'glutes', `secondary_muscles` = '["hamstrings"]', `equipment` = 'barbell', `exercise_type` = 'weight_reps', `instructions` = '1. Apoya la parte alta de la espalda en un banco con la barra sobre la cadera.
2. Empuja con los talones elevando la cadera hasta alinear tronco y muslos.
3. Aprieta los glúteos arriba y baja de forma controlada.' WHERE `name` = 'Hip Thrust';
UPDATE `exercises` SET `muscle_group` = 'glutes', `secondary_muscles` = '["hamstrings"]', `equipment` = 'cable', `exercise_type` = 'weight_reps', `instructions` = '1. Engancha la tobillera a la polea baja y apóyate en la máquina.
2. Lleva la pierna hacia atrás extendiéndola y apretando el glúteo.
3. Vuelve despacio sin arquear la espalda.' WHERE `name` = 'Cable Kickback';
