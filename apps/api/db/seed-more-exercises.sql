-- More system exercises for an already-seeded database (catalog.ts has the same list). Safe to re-run.
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Lying Leg Curl', 'hamstrings', '["calves"]', 'machine', 'weight_reps', '1. Túmbate boca abajo con el rodillo justo encima de los talones.
2. Flexiona las rodillas llevando los talones hacia los glúteos sin levantar la cadera.
3. Baja despacio hasta casi extender las piernas.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Standing Leg Curl', 'hamstrings', '[]', 'machine', 'weight_reps', '1. Apoya el pecho en la máquina y coloca el rodillo detrás del tobillo.
2. Flexiona una rodilla llevando el talón hacia el glúteo.
3. Baja controlando y cambia de pierna al terminar la serie.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Nordic Hamstring Curl', 'hamstrings', '["glutes"]', 'bodyweight', 'bodyweight_reps', '1. Arrodíllate con los tobillos sujetos.
2. Déjate caer hacia delante lo más lento posible manteniendo la cadera extendida.
3. Frena con las manos al final y vuelve empujando un poco con ellas.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Good Morning', 'hamstrings', '["lower_back", "glutes"]', 'barbell', 'weight_reps', '1. Coloca la barra sobre los trapecios con las rodillas ligeramente flexionadas.
2. Inclina el torso hacia delante llevando la cadera atrás y la espalda neutra.
3. Vuelve arriba apretando glúteos.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Deadlift', 'lower_back', '["hamstrings", "glutes", "traps"]', 'barbell', 'weight_reps', '1. Colócate con la barra sobre el medio del pie y agárrala a la anchura de los hombros.
2. Empuja el suelo con las piernas manteniendo la espalda neutra y la barra pegada.
3. Termina de pie con la cadera extendida y baja con control.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Sumo Deadlift', 'glutes', '["hamstrings", "adductors", "lower_back"]', 'barbell', 'weight_reps', '1. Abre bien los pies con las puntas hacia fuera y agarra la barra por dentro de las piernas.
2. Empuja las rodillas hacia fuera y sube manteniendo el pecho alto.
3. Bloquea arriba apretando glúteos y baja controlando.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Front Squat', 'quadriceps', '["glutes", "abdominals"]', 'barbell', 'weight_reps', '1. Apoya la barra delante de los hombros con los codos altos.
2. Baja manteniendo el torso erguido hasta romper el paralelo.
3. Sube empujando con todo el pie.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Goblet Squat', 'quadriceps', '["glutes"]', 'dumbbell', 'weight_reps', '1. Sujeta una mancuerna o kettlebell pegada al pecho.
2. Baja entre las rodillas con la espalda recta.
3. Sube empujando con los talones.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Hack Squat', 'quadriceps', '["glutes"]', 'machine', 'weight_reps', '1. Apoya la espalda en el respaldo con los pies a la anchura de la cadera.
2. Baja hasta que las rodillas formen unos 90 grados.
3. Empuja la plataforma hasta casi extender.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Smith Machine Squat', 'quadriceps', '["glutes"]', 'machine', 'weight_reps', '1. Coloca la barra sobre los trapecios con los pies un poco adelantados.
2. Baja controlando con la espalda recta.
3. Sube empujando con todo el pie.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Step Up', 'quadriceps', '["glutes"]', 'dumbbell', 'weight_reps', '1. Coloca un pie en un banco o cajón con una mancuerna en cada mano.
2. Sube empujando con la pierna de arriba sin impulsarte con la de abajo.
3. Baja con control y repite.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Walking Lunge', 'quadriceps', '["glutes", "hamstrings"]', 'dumbbell', 'weight_reps', '1. Da un paso largo hacia delante con una mancuerna en cada mano.
2. Baja la rodilla de atrás casi hasta el suelo.
3. Avanza con la otra pierna y repite.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Glute Bridge', 'glutes', '["hamstrings"]', 'bodyweight', 'bodyweight_reps', '1. Túmbate boca arriba con las rodillas flexionadas y los pies apoyados.
2. Eleva la cadera apretando glúteos hasta alinear rodillas, cadera y hombros.
3. Baja despacio sin apoyar del todo.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Barbell Hip Thrust', 'glutes', '["hamstrings"]', 'barbell', 'weight_reps', '1. Apoya la espalda alta en un banco con la barra sobre la cadera.
2. Empuja con los talones hasta extender la cadera.
3. Aguanta un segundo arriba y baja controlando.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Cable Pull Through', 'glutes', '["hamstrings"]', 'cable', 'weight_reps', '1. De espaldas a la polea baja, sujeta la cuerda entre las piernas.
2. Lleva la cadera atrás con la espalda recta.
3. Extiende la cadera apretando glúteos.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Hip Abduction Machine', 'abductors', '["glutes"]', 'machine', 'weight_reps', '1. Siéntate con las almohadillas por fuera de las rodillas.
2. Abre las piernas empujando hacia fuera.
3. Vuelve despacio sin dejar caer el peso.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Hip Adduction Machine', 'adductors', '[]', 'machine', 'weight_reps', '1. Siéntate con las almohadillas por dentro de las rodillas.
2. Junta las piernas apretando la cara interna del muslo.
3. Abre despacio controlando el peso.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Standing Calf Raise', 'calves', '[]', 'machine', 'weight_reps', '1. Apoya los hombros bajo las almohadillas y la punta de los pies en el borde.
2. Sube de puntillas todo lo que puedas.
3. Baja hasta estirar bien el gemelo.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Seated Calf Raise', 'calves', '[]', 'machine', 'weight_reps', '1. Siéntate con las rodillas bajo la almohadilla y las puntas en el borde.
2. Eleva los talones al máximo.
3. Baja despacio hasta estirar.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Leg Press Calf Raise', 'calves', '[]', 'machine', 'weight_reps', '1. En la prensa, apoya solo las puntas de los pies en el borde de la plataforma.
2. Empuja con los tobillos extendiendo el pie.
3. Vuelve despacio estirando el gemelo.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Dumbbell Bench Press', 'chest', '["triceps", "shoulders"]', 'dumbbell', 'weight_reps', '1. Túmbate con una mancuerna en cada mano a la altura del pecho.
2. Empuja hacia arriba juntando ligeramente las mancuernas.
3. Baja controlando hasta notar el estiramiento.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Decline Bench Press', 'chest', '["triceps"]', 'barbell', 'weight_reps', '1. Túmbate en el banco declinado con los pies sujetos.
2. Baja la barra a la parte baja del pecho.
3. Empuja hasta extender los codos.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Dumbbell Fly', 'chest', '["shoulders"]', 'dumbbell', 'weight_reps', '1. Túmbate con las mancuernas arriba y los codos un poco flexionados.
2. Abre los brazos en arco hasta notar el estiramiento del pecho.
3. Cierra apretando el pecho.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Push Up', 'chest', '["triceps", "shoulders"]', 'bodyweight', 'bodyweight_reps', '1. Apoya las manos algo más abiertas que los hombros y el cuerpo recto.
2. Baja el pecho casi hasta el suelo.
3. Empuja hasta extender los brazos.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Chest Dip', 'chest', '["triceps", "shoulders"]', 'bodyweight', 'bodyweight_reps', '1. Sujétate en las paralelas inclinando el torso hacia delante.
2. Baja hasta que los hombros queden a la altura de los codos.
3. Sube empujando sin bloquear del todo.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Pull Up', 'lats', '["biceps", "upper_back"]', 'bodyweight', 'bodyweight_reps', '1. Cuélgate de la barra con agarre prono algo más abierto que los hombros.
2. Sube llevando el pecho hacia la barra.
3. Baja despacio hasta extender los brazos.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Chin Up', 'lats', '["biceps"]', 'bodyweight', 'bodyweight_reps', '1. Cuélgate con agarre supino a la anchura de los hombros.
2. Sube hasta pasar la barbilla por encima de la barra.
3. Baja con control.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Assisted Pull Up', 'lats', '["biceps"]', 'machine', 'weight_reps', '1. Arrodíllate en la plataforma de asistencia y agarra la barra.
2. Sube llevando el pecho a la barra.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Barbell Row', 'upper_back', '["lats", "biceps"]', 'barbell', 'weight_reps', '1. Inclina el torso con la espalda recta y la barra colgando.
2. Tira de la barra hacia el ombligo juntando escápulas.
3. Baja controlando.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Dumbbell Row', 'lats', '["upper_back", "biceps"]', 'dumbbell', 'weight_reps', '1. Apoya una mano y una rodilla en el banco con la espalda recta.
2. Tira de la mancuerna hacia la cadera.
3. Baja hasta estirar el dorsal.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'T-Bar Row', 'upper_back', '["lats", "biceps"]', 'barbell', 'weight_reps', '1. Colócate sobre la barra con el torso inclinado y la espalda recta.
2. Tira del agarre hacia el pecho.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Cable Row', 'upper_back', '["lats", "biceps"]', 'cable', 'weight_reps', '1. Siéntate con los pies apoyados y la espalda recta.
2. Tira del agarre hacia el abdomen juntando escápulas.
3. Estira los brazos sin encorvar la espalda.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Straight Arm Pulldown', 'lats', '[]', 'cable', 'weight_reps', '1. De pie frente a la polea alta, agarra la barra con los brazos casi rectos.
2. Baja la barra hasta los muslos con los brazos extendidos.
3. Sube despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Face Pull', 'shoulders', '["upper_back", "traps"]', 'cable', 'weight_reps', '1. Con la cuerda a la altura de la cara, agárrala con las palmas hacia dentro.
2. Tira hacia la cara abriendo los codos.
3. Vuelve despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Shrug', 'traps', '[]', 'dumbbell', 'weight_reps', '1. De pie con una mancuerna en cada mano.
2. Eleva los hombros hacia las orejas.
3. Baja despacio sin girar los hombros.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Back Extension', 'lower_back', '["glutes", "hamstrings"]', 'bodyweight', 'bodyweight_reps', '1. Colócate en el banco de hiperextensiones con la cadera apoyada.
2. Baja el torso con la espalda recta.
3. Sube hasta alinear el cuerpo.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Overhead Press', 'shoulders', '["triceps"]', 'barbell', 'weight_reps', '1. De pie, sujeta la barra a la altura de las clavículas.
2. Empuja hacia arriba hasta extender los brazos.
3. Baja controlando a la posición inicial.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Dumbbell Shoulder Press', 'shoulders', '["triceps"]', 'dumbbell', 'weight_reps', '1. Sentado, sujeta las mancuernas a la altura de los hombros.
2. Empuja hacia arriba sin chocarlas.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Arnold Press', 'shoulders', '["triceps"]', 'dumbbell', 'weight_reps', '1. Empieza con las mancuernas delante del pecho y las palmas hacia ti.
2. Gira las muñecas mientras empujas hacia arriba.
3. Baja deshaciendo el giro.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Front Raise', 'shoulders', '[]', 'dumbbell', 'weight_reps', '1. De pie con las mancuernas delante de los muslos.
2. Eleva los brazos al frente hasta la altura de los hombros.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Rear Delt Fly', 'shoulders', '["upper_back"]', 'dumbbell', 'weight_reps', '1. Inclina el torso con una mancuerna en cada mano.
2. Abre los brazos hacia los lados apretando la parte trasera del hombro.
3. Baja controlando.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Reverse Pec Deck', 'shoulders', '["upper_back"]', 'machine', 'weight_reps', '1. Siéntate de cara al respaldo y agarra las asas.
2. Abre los brazos hacia atrás.
3. Vuelve despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Cable Lateral Raise', 'shoulders', '[]', 'cable', 'weight_reps', '1. De lado a la polea baja, agarra el estribo con la mano contraria.
2. Eleva el brazo hasta la altura del hombro.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Upright Row', 'shoulders', '["traps"]', 'barbell', 'weight_reps', '1. Sujeta la barra con agarre estrecho delante de los muslos.
2. Súbela pegada al cuerpo hasta el pecho con los codos altos.
3. Baja controlando.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Preacher Curl', 'biceps', '[]', 'barbell', 'weight_reps', '1. Apoya los brazos en el banco Scott.
2. Flexiona los codos subiendo la barra.
3. Baja despacio sin extender del todo de golpe.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Incline Dumbbell Curl', 'biceps', '[]', 'dumbbell', 'weight_reps', '1. Siéntate en un banco inclinado con los brazos colgando.
2. Flexiona los codos sin moverlos hacia delante.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Cable Curl', 'biceps', '[]', 'cable', 'weight_reps', '1. De pie frente a la polea baja, agarra la barra.
2. Flexiona los codos pegados al cuerpo.
3. Baja controlando.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Concentration Curl', 'biceps', '[]', 'dumbbell', 'weight_reps', '1. Sentado, apoya el codo en la cara interna del muslo.
2. Sube la mancuerna hacia el hombro.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Skull Crusher', 'triceps', '[]', 'barbell', 'weight_reps', '1. Túmbate con la barra sobre el pecho y los brazos extendidos.
2. Flexiona los codos bajando la barra hacia la frente.
3. Extiende los brazos sin abrir los codos.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Close Grip Bench Press', 'triceps', '["chest"]', 'barbell', 'weight_reps', '1. Túmbate y agarra la barra a la anchura de los hombros.
2. Baja a la parte baja del pecho con los codos pegados.
3. Empuja hasta extender.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Bench Dip', 'triceps', '["chest"]', 'bodyweight', 'bodyweight_reps', '1. Apoya las manos en un banco detrás de ti con las piernas estiradas.
2. Baja flexionando los codos.
3. Sube extendiendo los brazos.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Tricep Kickback', 'triceps', '[]', 'dumbbell', 'weight_reps', '1. Inclina el torso con el codo pegado al costado.
2. Extiende el brazo hacia atrás.
3. Vuelve despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Wrist Curl', 'forearms', '[]', 'dumbbell', 'weight_reps', '1. Sentado, apoya los antebrazos en los muslos con las palmas arriba.
2. Flexiona las muñecas subiendo la mancuerna.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Plank', 'abdominals', '[]', 'bodyweight', 'duration', '1. Apoya antebrazos y puntas de los pies con el cuerpo recto.
2. Aprieta abdomen y glúteos.
3. Aguanta sin dejar caer la cadera.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Hanging Leg Raise', 'abdominals', '[]', 'bodyweight', 'bodyweight_reps', '1. Cuélgate de una barra con los brazos extendidos.
2. Eleva las piernas hasta la horizontal o más.
3. Baja despacio sin balancearte.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Cable Crunch', 'abdominals', '[]', 'cable', 'weight_reps', '1. Arrodíllate frente a la polea alta con la cuerda junto a la cabeza.
2. Flexiona el tronco llevando los codos hacia las rodillas.
3. Vuelve despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Russian Twist', 'abdominals', '[]', 'bodyweight', 'bodyweight_reps', '1. Siéntate con el torso inclinado atrás y los pies elevados.
2. Gira el tronco de un lado a otro.
3. Mantén el abdomen apretado todo el tiempo.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Ab Wheel Rollout', 'abdominals', '[]', 'other', 'bodyweight_reps', '1. De rodillas, sujeta la rueda delante de ti.
2. Rueda hacia delante manteniendo la espalda neutra.
3. Vuelve apretando el abdomen.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Treadmill', 'cardio', '[]', 'machine', 'distance_duration', '1. Ajusta velocidad e inclinación.
2. Mantén una postura erguida y pasos cómodos.
3. Termina con unos minutos a ritmo suave.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Stationary Bike', 'cardio', '[]', 'machine', 'distance_duration', '1. Ajusta el sillín a la altura de la cadera.
2. Pedalea a un ritmo constante.
3. Termina con unos minutos suaves.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Rowing Machine', 'cardio', '["upper_back", "quadriceps"]', 'machine', 'distance_duration', '1. Empuja primero con las piernas, luego inclina el torso y tira con los brazos.
2. Vuelve en orden inverso: brazos, torso y piernas.
3. Mantén un ritmo constante.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Kettlebell Swing', 'glutes', '["hamstrings", "lower_back"]', 'kettlebell', 'weight_reps', '1. Sujeta la kettlebell con las dos manos entre las piernas.
2. Impúlsala extendiendo la cadera con fuerza hasta la altura del pecho.
3. Deja que baje y repite el movimiento de cadera.', NULL, 0, 0);
