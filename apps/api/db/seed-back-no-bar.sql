-- Back exercises that need no pull-up bar (db/catalog-extra.ts) for an already-seeded database. Safe to re-run.
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Prone Y Raise', 'traps', '["shoulders","upper_back"]', 'bodyweight', 'bodyweight_reps', '1. Túmbate boca abajo con la frente apoyada y los brazos estirados formando una Y.
2. Levanta los brazos con los pulgares hacia el techo juntando los omóplatos.
3. Baja despacio hasta rozar el suelo.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Prone T Raise', 'upper_back', '["traps","shoulders"]', 'bodyweight', 'bodyweight_reps', '1. Boca abajo, abre los brazos en cruz a la altura de los hombros.
2. Eleva los brazos juntando los omóplatos, con los pulgares hacia el techo.
3. Baja controlando hasta rozar el suelo.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Prone W Raise', 'upper_back', '["traps","shoulders"]', 'bodyweight', 'bodyweight_reps', '1. Boca abajo, flexiona los codos cerca del cuerpo formando una W.
2. Eleva codos y manos llevando los omóplatos hacia la columna.
3. Baja despacio manteniendo el cuello relajado.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Reverse Snow Angel', 'upper_back', '["traps","shoulders"]', 'bodyweight', 'bodyweight_reps', '1. Boca abajo con los brazos pegados al cuerpo y las palmas hacia abajo.
2. Desliza los brazos por el suelo hasta llevarlos por encima de la cabeza sin doblar los codos.
3. Vuelve al inicio por el mismo recorrido, despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Prone Cobra', 'upper_back', '["lower_back","traps"]', 'bodyweight', 'duration', '1. Boca abajo con los brazos a los lados y las palmas hacia el suelo.
2. Despega pecho y brazos girando las palmas hacia fuera y juntando los omóplatos.
3. Mantén la posición respirando con normalidad y baja despacio.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Band Lat Pulldown', 'lats', '["biceps","upper_back"]', 'band', 'weight_reps', '1. Ancla la banda por encima de la cabeza y sujeta un extremo con cada mano.
2. Tira hacia abajo llevando los codos hacia las costillas.
3. Sube los brazos despacio hasta estirarlos del todo.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Band Straight Arm Pulldown', 'lats', '[]', 'band', 'weight_reps', '1. Ancla la banda a la altura de la cabeza y agárrala con los brazos estirados.
2. Baja los brazos rectos hasta los muslos sin flexionar los codos.
3. Vuelve arriba controlando la tensión.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Band Seated Row', 'upper_back', '["lats","biceps"]', 'band', 'weight_reps', '1. Siéntate en el suelo con las piernas estiradas y pasa la banda por las plantas de los pies.
2. Tira de los extremos hacia el abdomen llevando los codos atrás.
3. Estira los brazos despacio manteniendo la espalda recta.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Single Arm Band Row', 'upper_back', '["lats","biceps"]', 'band', 'weight_reps', '1. Ancla la banda a la altura del pecho y sujétala con una mano.
2. Tira del extremo hacia el costado pegando el codo al cuerpo.
3. Estira el brazo despacio y repite con el otro lado.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Band Bent Over Row', 'upper_back', '["lats","biceps"]', 'band', 'weight_reps', '1. Pisa el centro de la banda y sujeta un extremo con cada mano.
2. Inclina el tronco con la espalda recta y tira de la banda hacia el abdomen.
3. Baja los brazos despacio sin encorvar la espalda.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Band Face Pull', 'shoulders', '["upper_back","traps"]', 'band', 'weight_reps', '1. Ancla la banda a la altura de la cara y agárrala con las dos manos.
2. Tira hacia la frente abriendo los codos a la altura de los hombros.
3. Vuelve al inicio controlando la tensión.', NULL, 0, 0);
INSERT OR IGNORE INTO exercises (id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, owner_id, is_archived, created_at) VALUES (lower(hex(randomblob(16))), 'Band Shrug', 'traps', '[]', 'band', 'weight_reps', '1. Pisa el centro de la banda y sujeta un extremo con cada mano, con los brazos estirados.
2. Eleva los hombros hacia las orejas sin flexionar los codos.
3. Baja despacio hasta notar el estiramiento del trapecio.', NULL, 0, 0);
