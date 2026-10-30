-- More system exercises for an already-seeded database (catalog.ts has the same list). Safe to re-run.
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Incline Dumbbell Press', 'chest', '["shoulders", "triceps"]', 'dumbbell', 'weight_reps', '1. Ajusta el banco a 30–45 grados y apoya la espalda con una mancuerna en cada mano.
2. Empuja hacia arriba juntando ligeramente las mancuernas sobre el pecho.
3. Baja despacio hasta la parte alta del pecho.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Incline Dumbbell Fly', 'chest', '["shoulders"]', 'dumbbell', 'weight_reps', '1. En banco inclinado, sujeta las mancuernas arriba con los codos un poco flexionados.
2. Abre los brazos en arco hasta notar el estiramiento del pecho alto.
3. Cierra apretando el pecho.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Smith Machine Incline Press', 'chest', '["shoulders", "triceps"]', 'machine', 'weight_reps', '1. Coloca el banco inclinado bajo la barra guiada.
2. Baja la barra a la parte alta del pecho.
3. Empuja hasta casi extender los codos.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Incline Chest Press Machine', 'chest', '["shoulders", "triceps"]', 'machine', 'weight_reps', '1. Ajusta el asiento para que los agarres queden a la altura del pecho alto.
2. Empuja hacia delante y arriba sin bloquear los codos.
3. Vuelve despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Low to High Cable Fly', 'chest', '["shoulders"]', 'cable', 'weight_reps', '1. Con las poleas abajo, agarra los estribos y da un paso al frente.
2. Sube las manos en arco hasta juntarlas a la altura del pecho.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Machine Shoulder Press', 'shoulders', '["triceps"]', 'machine', 'weight_reps', '1. Ajusta el asiento para que los agarres queden a la altura de los hombros.
2. Empuja hacia arriba sin bloquear los codos.
3. Baja controlando.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Pendulum Squat', 'quadriceps', '["glutes"]', 'machine', 'weight_reps', '1. Apoya la espalda y los hombros en la máquina con los pies adelantados.
2. Baja todo lo que permita tu movilidad con la espalda apoyada.
3. Empuja con todo el pie hasta casi extender.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Single Leg Press', 'quadriceps', '["glutes"]', 'machine', 'weight_reps', '1. En la prensa, apoya un solo pie en el centro de la plataforma.
2. Baja hasta unos 90 grados de rodilla.
3. Empuja y repite antes de cambiar de pierna.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Glute Kickback Machine', 'glutes', '["hamstrings"]', 'machine', 'weight_reps', '1. Apoya el pecho y coloca un pie en la plataforma.
2. Empuja hacia atrás extendiendo la cadera.
3. Vuelve despacio sin arquear la espalda.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Reverse Lunge', 'glutes', '["quadriceps", "hamstrings"]', 'dumbbell', 'weight_reps', '1. De pie con una mancuerna en cada mano.
2. Da un paso atrás y baja la rodilla casi hasta el suelo.
3. Vuelve empujando con la pierna de delante.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Seated Dumbbell Lateral Raise', 'shoulders', '[]', 'dumbbell', 'weight_reps', '1. Sentado con una mancuerna en cada mano a los lados.
2. Eleva los brazos hasta la altura de los hombros.
3. Baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'EZ Bar Curl', 'biceps', '["forearms"]', 'barbell', 'weight_reps', '1. Sujeta la barra Z con agarre supino.
2. Flexiona los codos sin moverlos hacia delante.
3. Baja controlando.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Rope Tricep Pushdown', 'triceps', '[]', 'cable', 'weight_reps', '1. Agarra la cuerda de la polea alta con los codos pegados.
2. Extiende los brazos separando la cuerda abajo.
3. Sube despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Chest Supported Row', 'upper_back', '["lats", "biceps"]', 'machine', 'weight_reps', '1. Apoya el pecho en el respaldo y agarra las asas.
2. Tira hacia atrás juntando escápulas.
3. Estira los brazos despacio.', NULL, 0, 0);
