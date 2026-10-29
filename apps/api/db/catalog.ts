// Exercise catalog for the system exercises (ADR-017): Hevy muscle taxonomy, equipment, type, Spanish instructions.
export interface CatalogExercise {
  name: string;
  primary: string;
  secondary: string[];
  equipment: string;
  type: string;
  instructions: string;
}

export const EXERCISE_CATALOG: CatalogExercise[] = [
  {
    "name": "Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Acuéstate en el banco con los pies firmes en el suelo y los omóplatos juntos.\n2. Baja la barra de forma controlada hasta rozar la mitad del pecho.\n3. Empuja hacia arriba hasta extender los codos sin bloquearlos."
  },
  {
    "name": "Incline Press",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "triceps"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Ajusta el banco a unos 30 grados y siéntate con la espalda apoyada.\n2. Baja las mancuernas hasta la parte alta del pecho.\n3. Empuja hacia arriba juntando ligeramente las mancuernas."
  },
  {
    "name": "Incline Bench Press",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "triceps"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Ajusta el banco a unos 30 grados y agarra la barra algo más ancho que los hombros.\n2. Baja la barra hasta la parte alta del pecho de forma controlada.\n3. Empuja hasta extender los brazos sin despegar la espalda del banco."
  },
  {
    "name": "Chest Press Machine",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Ajusta el asiento para que las asas queden a la altura del pecho.\n2. Empuja las asas hacia delante hasta casi extender los brazos.\n3. Vuelve despacio hasta sentir el estiramiento del pecho."
  },
  {
    "name": "Chest Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Acuéstate en el banco con una mancuerna en cada mano a la altura del pecho.\n2. Empuja hacia arriba hasta extender los brazos.\n3. Baja de forma controlada hasta que los codos queden a la altura del banco."
  },
  {
    "name": "Pec Deck",
    "primary": "chest",
    "secondary": [
      "shoulders"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate con la espalda apoyada y los antebrazos sobre las almohadillas.\n2. Junta los brazos delante del pecho apretando el pecho.\n3. Vuelve despacio sin dejar que las pesas se apoyen."
  },
  {
    "name": "Cable Crossover",
    "primary": "chest",
    "secondary": [],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. Coloca las poleas altas y da un paso al frente.\n2. Lleva las manos hacia abajo y al centro, cruzándolas frente al abdomen.\n3. Vuelve controlando la tensión hasta abrir el pecho."
  },
  {
    "name": "Shoulder Press",
    "primary": "shoulders",
    "secondary": [
      "triceps"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Siéntate con la espalda recta y las mancuernas a la altura de los hombros.\n2. Empuja hacia arriba hasta casi extender los brazos.\n3. Baja de forma controlada hasta la altura de las orejas."
  },
  {
    "name": "Lateral Raises",
    "primary": "shoulders",
    "secondary": [],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. De pie, con una mancuerna en cada mano y los codos ligeramente flexionados.\n2. Eleva los brazos hacia los lados hasta la altura de los hombros.\n3. Baja despacio sin balancear el torso."
  },
  {
    "name": "Tricep Pulldown",
    "primary": "triceps",
    "secondary": [],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. Agarra la barra o la cuerda de la polea alta con los codos pegados al cuerpo.\n2. Extiende los codos hacia abajo hasta contraer el tríceps.\n3. Sube controlando hasta que los antebrazos queden a unos 90 grados."
  },
  {
    "name": "Overhead Tricep Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Sostén una mancuerna con ambas manos detrás de la cabeza.\n2. Extiende los codos hacia arriba sin abrirlos.\n3. Baja despacio hasta sentir el estiramiento del tríceps."
  },
  {
    "name": "Tricep Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. De espaldas a la polea baja, sostén la cuerda con los codos cerca de la cabeza.\n2. Extiende los brazos hacia delante y arriba.\n3. Vuelve de forma controlada sin mover los codos."
  },
  {
    "name": "Lat Pulldown",
    "primary": "lats",
    "secondary": [
      "biceps"
    ],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. Siéntate agarrando la barra más ancho que los hombros, con el pecho alto.\n2. Tira de la barra hacia la parte alta del pecho llevando los codos hacia abajo.\n3. Sube despacio hasta extender los brazos."
  },
  {
    "name": "Row",
    "primary": "upper_back",
    "secondary": [
      "lats",
      "biceps"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Inclinado hacia delante con la espalda recta, agarra la barra a la altura de las rodillas.\n2. Tira de la barra hacia el abdomen juntando los omóplatos.\n3. Baja de forma controlada sin redondear la espalda."
  },
  {
    "name": "Pullover",
    "primary": "lats",
    "secondary": [
      "chest"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Acuéstate cruzado en el banco sosteniendo una mancuerna sobre el pecho.\n2. Baja la mancuerna detrás de la cabeza con los brazos casi rectos.\n3. Vuelve al punto de partida usando los dorsales."
  },
  {
    "name": "Seated Row",
    "primary": "upper_back",
    "secondary": [
      "lats",
      "biceps"
    ],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. Siéntate con los pies en las plataformas y la espalda recta.\n2. Tira del agarre hacia el abdomen juntando los omóplatos.\n3. Vuelve despacio hasta extender los brazos sin encorvarte."
  },
  {
    "name": "Barbell Bicep Curl",
    "primary": "biceps",
    "secondary": [
      "forearms"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. De pie, agarra la barra con las palmas hacia arriba y los codos pegados al torso.\n2. Flexiona los codos llevando la barra hacia los hombros.\n3. Baja de forma controlada hasta extender los brazos."
  },
  {
    "name": "Hammer Curl",
    "primary": "biceps",
    "secondary": [
      "forearms"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. De pie, sostén las mancuernas con las palmas enfrentadas.\n2. Flexiona los codos sin girar las muñecas.\n3. Baja despacio hasta extender los brazos."
  },
  {
    "name": "Bicep Curl",
    "primary": "biceps",
    "secondary": [],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. De pie, con una mancuerna en cada mano y las palmas hacia delante.\n2. Flexiona los codos llevando las mancuernas hacia los hombros.\n3. Baja de forma controlada sin balancear el cuerpo."
  },
  {
    "name": "Crunches",
    "primary": "abdominals",
    "secondary": [],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Acuéstate boca arriba con las rodillas flexionadas y las manos junto a la cabeza.\n2. Eleva los hombros del suelo contrayendo el abdomen.\n3. Baja despacio sin tirar del cuello."
  },
  {
    "name": "Squat",
    "primary": "quadriceps",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Coloca la barra sobre la parte alta de la espalda y separa los pies al ancho de los hombros.\n2. Baja flexionando cadera y rodillas hasta que los muslos queden paralelos al suelo.\n3. Empuja con los talones para subir manteniendo la espalda recta."
  },
  {
    "name": "Leg Press",
    "primary": "quadriceps",
    "secondary": [
      "glutes"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate con la espalda apoyada y los pies a la anchura de los hombros.\n2. Baja la plataforma hasta que las rodillas formen unos 90 grados.\n3. Empuja hasta casi extender las piernas sin bloquear las rodillas."
  },
  {
    "name": "Leg Extension",
    "primary": "quadriceps",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate con la espalda apoyada y el rodillo sobre los tobillos.\n2. Extiende las rodillas hasta elevar las piernas.\n3. Baja despacio sin dejar caer el peso."
  },
  {
    "name": "Bulgarian Squat",
    "primary": "quadriceps",
    "secondary": [
      "glutes"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Apoya el pie de atrás sobre un banco y sostén una mancuerna en cada mano.\n2. Baja flexionando la rodilla delantera hasta que el muslo quede paralelo al suelo.\n3. Empuja con el talón de delante para subir."
  },
  {
    "name": "Adductors",
    "primary": "adductors",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate en la máquina con las piernas abiertas sobre las almohadillas.\n2. Junta las piernas apretando la parte interna del muslo.\n3. Vuelve despacio sin soltar el peso de golpe."
  },
  {
    "name": "Abductors",
    "primary": "abductors",
    "secondary": [
      "glutes"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate en la máquina con las piernas juntas contra las almohadillas.\n2. Abre las piernas hacia fuera empujando con los glúteos.\n3. Vuelve de forma controlada hasta juntarlas."
  },
  {
    "name": "Calves",
    "primary": "calves",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Apoya la punta de los pies en la plataforma con los talones fuera.\n2. Eleva los talones lo más alto posible.\n3. Baja despacio hasta sentir el estiramiento de la pantorrilla."
  },
  {
    "name": "Lunges",
    "primary": "quadriceps",
    "secondary": [
      "glutes"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. De pie, con una mancuerna en cada mano, da un paso largo hacia delante.\n2. Baja la rodilla de atrás casi hasta el suelo.\n3. Empuja con la pierna de delante para volver al inicio."
  },
  {
    "name": "Romanian Deadlift",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "lower_back"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. De pie, sostén la barra frente a los muslos con las rodillas ligeramente flexionadas.\n2. Lleva la cadera hacia atrás bajando la barra pegada a las piernas, con la espalda recta.\n3. Sube empujando la cadera hacia delante hasta quedar de pie."
  },
  {
    "name": "Leg Curl",
    "primary": "hamstrings",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Ajusta la máquina para que el rodillo quede sobre los tobillos.\n2. Flexiona las rodillas llevando los talones hacia los glúteos.\n3. Vuelve despacio hasta extender las piernas."
  },
  {
    "name": "Hip Thrust",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Apoya la parte alta de la espalda en un banco con la barra sobre la cadera.\n2. Empuja con los talones elevando la cadera hasta alinear tronco y muslos.\n3. Aprieta los glúteos arriba y baja de forma controlada."
  },
  {
    "name": "Cable Kickback",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. Engancha la tobillera a la polea baja y apóyate en la máquina.\n2. Lleva la pierna hacia atrás extendiéndola y apretando el glúteo.\n3. Vuelve despacio sin arquear la espalda."
  },
  {
    "name": "Dumbbell Romanian Deadlift",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "lower_back"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. De pie, sostén una mancuerna en cada mano frente a los muslos con las rodillas ligeramente flexionadas.\n2. Lleva la cadera hacia atrás bajando las mancuernas pegadas a las piernas, con la espalda recta.\n3. Sube empujando la cadera hacia delante hasta quedar de pie."
  },
{
    "name": "Plate-Loaded Hip Thrust (Belt)",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Apoya la parte alta de la espalda en el banco y ajusta el cinturón con el disco sobre la cadera.\n2. Empuja con los talones elevando la cadera hasta alinear tronco y muslos.\n3. Aprieta los glúteos arriba y baja de forma controlada."
  },
{
    "name": "Seated Leg Curl",
    "primary": "hamstrings",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate con la espalda apoyada y el rodillo sobre los tobillos.\n2. Flexiona las rodillas llevando los talones hacia abajo y atrás.\n3. Vuelve despacio hasta extender las piernas."
  }
];
