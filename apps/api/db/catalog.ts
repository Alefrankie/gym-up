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
  },
  {
    "name": "Lying Leg Curl",
    "primary": "hamstrings",
    "secondary": [
      "calves"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Túmbate boca abajo con el rodillo justo encima de los talones.\n2. Flexiona las rodillas llevando los talones hacia los glúteos sin levantar la cadera.\n3. Baja despacio hasta casi extender las piernas."
  },
  {
    "name": "Standing Leg Curl",
    "primary": "hamstrings",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Apoya el pecho en la máquina y coloca el rodillo detrás del tobillo.\n2. Flexiona una rodilla llevando el talón hacia el glúteo.\n3. Baja controlando y cambia de pierna al terminar la serie."
  },
  {
    "name": "Nordic Hamstring Curl",
    "primary": "hamstrings",
    "secondary": [
      "glutes"
    ],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Arrodíllate con los tobillos sujetos.\n2. Déjate caer hacia delante lo más lento posible manteniendo la cadera extendida.\n3. Frena con las manos al final y vuelve empujando un poco con ellas."
  },
  {
    "name": "Good Morning",
    "primary": "hamstrings",
    "secondary": [
      "lower_back",
      "glutes"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Coloca la barra sobre los trapecios con las rodillas ligeramente flexionadas.\n2. Inclina el torso hacia delante llevando la cadera atrás y la espalda neutra.\n3. Vuelve arriba apretando glúteos."
  },
  {
    "name": "Deadlift",
    "primary": "lower_back",
    "secondary": [
      "hamstrings",
      "glutes",
      "traps"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Colócate con la barra sobre el medio del pie y agárrala a la anchura de los hombros.\n2. Empuja el suelo con las piernas manteniendo la espalda neutra y la barra pegada.\n3. Termina de pie con la cadera extendida y baja con control."
  },
  {
    "name": "Sumo Deadlift",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "adductors",
      "lower_back"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Abre bien los pies con las puntas hacia fuera y agarra la barra por dentro de las piernas.\n2. Empuja las rodillas hacia fuera y sube manteniendo el pecho alto.\n3. Bloquea arriba apretando glúteos y baja controlando."
  },
  {
    "name": "Front Squat",
    "primary": "quadriceps",
    "secondary": [
      "glutes",
      "abdominals"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Apoya la barra delante de los hombros con los codos altos.\n2. Baja manteniendo el torso erguido hasta romper el paralelo.\n3. Sube empujando con todo el pie."
  },
  {
    "name": "Goblet Squat",
    "primary": "quadriceps",
    "secondary": [
      "glutes"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Sujeta una mancuerna o kettlebell pegada al pecho.\n2. Baja entre las rodillas con la espalda recta.\n3. Sube empujando con los talones."
  },
  {
    "name": "Hack Squat",
    "primary": "quadriceps",
    "secondary": [
      "glutes"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Apoya la espalda en el respaldo con los pies a la anchura de la cadera.\n2. Baja hasta que las rodillas formen unos 90 grados.\n3. Empuja la plataforma hasta casi extender."
  },
  {
    "name": "Smith Machine Squat",
    "primary": "quadriceps",
    "secondary": [
      "glutes"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Coloca la barra sobre los trapecios con los pies un poco adelantados.\n2. Baja controlando con la espalda recta.\n3. Sube empujando con todo el pie."
  },
  {
    "name": "Step Up",
    "primary": "quadriceps",
    "secondary": [
      "glutes"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Coloca un pie en un banco o cajón con una mancuerna en cada mano.\n2. Sube empujando con la pierna de arriba sin impulsarte con la de abajo.\n3. Baja con control y repite."
  },
  {
    "name": "Walking Lunge",
    "primary": "quadriceps",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Da un paso largo hacia delante con una mancuerna en cada mano.\n2. Baja la rodilla de atrás casi hasta el suelo.\n3. Avanza con la otra pierna y repite."
  },
  {
    "name": "Glute Bridge",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Túmbate boca arriba con las rodillas flexionadas y los pies apoyados.\n2. Eleva la cadera apretando glúteos hasta alinear rodillas, cadera y hombros.\n3. Baja despacio sin apoyar del todo."
  },
  {
    "name": "Barbell Hip Thrust",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Apoya la espalda alta en un banco con la barra sobre la cadera.\n2. Empuja con los talones hasta extender la cadera.\n3. Aguanta un segundo arriba y baja controlando."
  },
  {
    "name": "Cable Pull Through",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. De espaldas a la polea baja, sujeta la cuerda entre las piernas.\n2. Lleva la cadera atrás con la espalda recta.\n3. Extiende la cadera apretando glúteos."
  },
  {
    "name": "Hip Abduction Machine",
    "primary": "abductors",
    "secondary": [
      "glutes"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate con las almohadillas por fuera de las rodillas.\n2. Abre las piernas empujando hacia fuera.\n3. Vuelve despacio sin dejar caer el peso."
  },
  {
    "name": "Hip Adduction Machine",
    "primary": "adductors",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate con las almohadillas por dentro de las rodillas.\n2. Junta las piernas apretando la cara interna del muslo.\n3. Abre despacio controlando el peso."
  },
  {
    "name": "Standing Calf Raise",
    "primary": "calves",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Apoya los hombros bajo las almohadillas y la punta de los pies en el borde.\n2. Sube de puntillas todo lo que puedas.\n3. Baja hasta estirar bien el gemelo."
  },
  {
    "name": "Seated Calf Raise",
    "primary": "calves",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate con las rodillas bajo la almohadilla y las puntas en el borde.\n2. Eleva los talones al máximo.\n3. Baja despacio hasta estirar."
  },
  {
    "name": "Leg Press Calf Raise",
    "primary": "calves",
    "secondary": [],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. En la prensa, apoya solo las puntas de los pies en el borde de la plataforma.\n2. Empuja con los tobillos extendiendo el pie.\n3. Vuelve despacio estirando el gemelo."
  },
  {
    "name": "Dumbbell Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Túmbate con una mancuerna en cada mano a la altura del pecho.\n2. Empuja hacia arriba juntando ligeramente las mancuernas.\n3. Baja controlando hasta notar el estiramiento."
  },
  {
    "name": "Decline Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Túmbate en el banco declinado con los pies sujetos.\n2. Baja la barra a la parte baja del pecho.\n3. Empuja hasta extender los codos."
  },
  {
    "name": "Dumbbell Fly",
    "primary": "chest",
    "secondary": [
      "shoulders"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Túmbate con las mancuernas arriba y los codos un poco flexionados.\n2. Abre los brazos en arco hasta notar el estiramiento del pecho.\n3. Cierra apretando el pecho."
  },
  {
    "name": "Push Up",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Apoya las manos algo más abiertas que los hombros y el cuerpo recto.\n2. Baja el pecho casi hasta el suelo.\n3. Empuja hasta extender los brazos."
  },
  {
    "name": "Chest Dip",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Sujétate en las paralelas inclinando el torso hacia delante.\n2. Baja hasta que los hombros queden a la altura de los codos.\n3. Sube empujando sin bloquear del todo."
  },
  {
    "name": "Pull Up",
    "primary": "lats",
    "secondary": [
      "biceps",
      "upper_back"
    ],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Cuélgate de la barra con agarre prono algo más abierto que los hombros.\n2. Sube llevando el pecho hacia la barra.\n3. Baja despacio hasta extender los brazos."
  },
  {
    "name": "Chin Up",
    "primary": "lats",
    "secondary": [
      "biceps"
    ],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Cuélgate con agarre supino a la anchura de los hombros.\n2. Sube hasta pasar la barbilla por encima de la barra.\n3. Baja con control."
  },
  {
    "name": "Assisted Pull Up",
    "primary": "lats",
    "secondary": [
      "biceps"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Arrodíllate en la plataforma de asistencia y agarra la barra.\n2. Sube llevando el pecho a la barra.\n3. Baja despacio."
  },
  {
    "name": "Barbell Row",
    "primary": "upper_back",
    "secondary": [
      "lats",
      "biceps"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Inclina el torso con la espalda recta y la barra colgando.\n2. Tira de la barra hacia el ombligo juntando escápulas.\n3. Baja controlando."
  },
  {
    "name": "Dumbbell Row",
    "primary": "lats",
    "secondary": [
      "upper_back",
      "biceps"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Apoya una mano y una rodilla en el banco con la espalda recta.\n2. Tira de la mancuerna hacia la cadera.\n3. Baja hasta estirar el dorsal."
  },
  {
    "name": "T-Bar Row",
    "primary": "upper_back",
    "secondary": [
      "lats",
      "biceps"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Colócate sobre la barra con el torso inclinado y la espalda recta.\n2. Tira del agarre hacia el pecho.\n3. Baja despacio."
  },
  {
    "name": "Cable Row",
    "primary": "upper_back",
    "secondary": [
      "lats",
      "biceps"
    ],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. Siéntate con los pies apoyados y la espalda recta.\n2. Tira del agarre hacia el abdomen juntando escápulas.\n3. Estira los brazos sin encorvar la espalda."
  },
  {
    "name": "Straight Arm Pulldown",
    "primary": "lats",
    "secondary": [],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. De pie frente a la polea alta, agarra la barra con los brazos casi rectos.\n2. Baja la barra hasta los muslos con los brazos extendidos.\n3. Sube despacio."
  },
  {
    "name": "Face Pull",
    "primary": "shoulders",
    "secondary": [
      "upper_back",
      "traps"
    ],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. Con la cuerda a la altura de la cara, agárrala con las palmas hacia dentro.\n2. Tira hacia la cara abriendo los codos.\n3. Vuelve despacio."
  },
  {
    "name": "Shrug",
    "primary": "traps",
    "secondary": [],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. De pie con una mancuerna en cada mano.\n2. Eleva los hombros hacia las orejas.\n3. Baja despacio sin girar los hombros."
  },
  {
    "name": "Back Extension",
    "primary": "lower_back",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Colócate en el banco de hiperextensiones con la cadera apoyada.\n2. Baja el torso con la espalda recta.\n3. Sube hasta alinear el cuerpo."
  },
  {
    "name": "Overhead Press",
    "primary": "shoulders",
    "secondary": [
      "triceps"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. De pie, sujeta la barra a la altura de las clavículas.\n2. Empuja hacia arriba hasta extender los brazos.\n3. Baja controlando a la posición inicial."
  },
  {
    "name": "Dumbbell Shoulder Press",
    "primary": "shoulders",
    "secondary": [
      "triceps"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Sentado, sujeta las mancuernas a la altura de los hombros.\n2. Empuja hacia arriba sin chocarlas.\n3. Baja despacio."
  },
  {
    "name": "Arnold Press",
    "primary": "shoulders",
    "secondary": [
      "triceps"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Empieza con las mancuernas delante del pecho y las palmas hacia ti.\n2. Gira las muñecas mientras empujas hacia arriba.\n3. Baja deshaciendo el giro."
  },
  {
    "name": "Front Raise",
    "primary": "shoulders",
    "secondary": [],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. De pie con las mancuernas delante de los muslos.\n2. Eleva los brazos al frente hasta la altura de los hombros.\n3. Baja despacio."
  },
  {
    "name": "Rear Delt Fly",
    "primary": "shoulders",
    "secondary": [
      "upper_back"
    ],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Inclina el torso con una mancuerna en cada mano.\n2. Abre los brazos hacia los lados apretando la parte trasera del hombro.\n3. Baja controlando."
  },
  {
    "name": "Reverse Pec Deck",
    "primary": "shoulders",
    "secondary": [
      "upper_back"
    ],
    "equipment": "machine",
    "type": "weight_reps",
    "instructions": "1. Siéntate de cara al respaldo y agarra las asas.\n2. Abre los brazos hacia atrás.\n3. Vuelve despacio."
  },
  {
    "name": "Cable Lateral Raise",
    "primary": "shoulders",
    "secondary": [],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. De lado a la polea baja, agarra el estribo con la mano contraria.\n2. Eleva el brazo hasta la altura del hombro.\n3. Baja despacio."
  },
  {
    "name": "Upright Row",
    "primary": "shoulders",
    "secondary": [
      "traps"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Sujeta la barra con agarre estrecho delante de los muslos.\n2. Súbela pegada al cuerpo hasta el pecho con los codos altos.\n3. Baja controlando."
  },
  {
    "name": "Preacher Curl",
    "primary": "biceps",
    "secondary": [],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Apoya los brazos en el banco Scott.\n2. Flexiona los codos subiendo la barra.\n3. Baja despacio sin extender del todo de golpe."
  },
  {
    "name": "Incline Dumbbell Curl",
    "primary": "biceps",
    "secondary": [],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Siéntate en un banco inclinado con los brazos colgando.\n2. Flexiona los codos sin moverlos hacia delante.\n3. Baja despacio."
  },
  {
    "name": "Cable Curl",
    "primary": "biceps",
    "secondary": [],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. De pie frente a la polea baja, agarra la barra.\n2. Flexiona los codos pegados al cuerpo.\n3. Baja controlando."
  },
  {
    "name": "Concentration Curl",
    "primary": "biceps",
    "secondary": [],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Sentado, apoya el codo en la cara interna del muslo.\n2. Sube la mancuerna hacia el hombro.\n3. Baja despacio."
  },
  {
    "name": "Skull Crusher",
    "primary": "triceps",
    "secondary": [],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Túmbate con la barra sobre el pecho y los brazos extendidos.\n2. Flexiona los codos bajando la barra hacia la frente.\n3. Extiende los brazos sin abrir los codos."
  },
  {
    "name": "Close Grip Bench Press",
    "primary": "triceps",
    "secondary": [
      "chest"
    ],
    "equipment": "barbell",
    "type": "weight_reps",
    "instructions": "1. Túmbate y agarra la barra a la anchura de los hombros.\n2. Baja a la parte baja del pecho con los codos pegados.\n3. Empuja hasta extender."
  },
  {
    "name": "Bench Dip",
    "primary": "triceps",
    "secondary": [
      "chest"
    ],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Apoya las manos en un banco detrás de ti con las piernas estiradas.\n2. Baja flexionando los codos.\n3. Sube extendiendo los brazos."
  },
  {
    "name": "Tricep Kickback",
    "primary": "triceps",
    "secondary": [],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Inclina el torso con el codo pegado al costado.\n2. Extiende el brazo hacia atrás.\n3. Vuelve despacio."
  },
  {
    "name": "Wrist Curl",
    "primary": "forearms",
    "secondary": [],
    "equipment": "dumbbell",
    "type": "weight_reps",
    "instructions": "1. Sentado, apoya los antebrazos en los muslos con las palmas arriba.\n2. Flexiona las muñecas subiendo la mancuerna.\n3. Baja despacio."
  },
  {
    "name": "Plank",
    "primary": "abdominals",
    "secondary": [],
    "equipment": "bodyweight",
    "type": "duration",
    "instructions": "1. Apoya antebrazos y puntas de los pies con el cuerpo recto.\n2. Aprieta abdomen y glúteos.\n3. Aguanta sin dejar caer la cadera."
  },
  {
    "name": "Hanging Leg Raise",
    "primary": "abdominals",
    "secondary": [],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Cuélgate de una barra con los brazos extendidos.\n2. Eleva las piernas hasta la horizontal o más.\n3. Baja despacio sin balancearte."
  },
  {
    "name": "Cable Crunch",
    "primary": "abdominals",
    "secondary": [],
    "equipment": "cable",
    "type": "weight_reps",
    "instructions": "1. Arrodíllate frente a la polea alta con la cuerda junto a la cabeza.\n2. Flexiona el tronco llevando los codos hacia las rodillas.\n3. Vuelve despacio."
  },
  {
    "name": "Russian Twist",
    "primary": "abdominals",
    "secondary": [],
    "equipment": "bodyweight",
    "type": "bodyweight_reps",
    "instructions": "1. Siéntate con el torso inclinado atrás y los pies elevados.\n2. Gira el tronco de un lado a otro.\n3. Mantén el abdomen apretado todo el tiempo."
  },
  {
    "name": "Ab Wheel Rollout",
    "primary": "abdominals",
    "secondary": [],
    "equipment": "other",
    "type": "bodyweight_reps",
    "instructions": "1. De rodillas, sujeta la rueda delante de ti.\n2. Rueda hacia delante manteniendo la espalda neutra.\n3. Vuelve apretando el abdomen."
  },
  {
    "name": "Treadmill",
    "primary": "cardio",
    "secondary": [],
    "equipment": "machine",
    "type": "distance_duration",
    "instructions": "1. Ajusta velocidad e inclinación.\n2. Mantén una postura erguida y pasos cómodos.\n3. Termina con unos minutos a ritmo suave."
  },
  {
    "name": "Stationary Bike",
    "primary": "cardio",
    "secondary": [],
    "equipment": "machine",
    "type": "distance_duration",
    "instructions": "1. Ajusta el sillín a la altura de la cadera.\n2. Pedalea a un ritmo constante.\n3. Termina con unos minutos suaves."
  },
  {
    "name": "Rowing Machine",
    "primary": "cardio",
    "secondary": [
      "upper_back",
      "quadriceps"
    ],
    "equipment": "machine",
    "type": "distance_duration",
    "instructions": "1. Empuja primero con las piernas, luego inclina el torso y tira con los brazos.\n2. Vuelve en orden inverso: brazos, torso y piernas.\n3. Mantén un ritmo constante."
  },
  {
    "name": "Kettlebell Swing",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lower_back"
    ],
    "equipment": "kettlebell",
    "type": "weight_reps",
    "instructions": "1. Sujeta la kettlebell con las dos manos entre las piernas.\n2. Impúlsala extendiendo la cadera con fuerza hasta la altura del pecho.\n3. Deja que baje y repite el movimiento de cadera."
  }
];
