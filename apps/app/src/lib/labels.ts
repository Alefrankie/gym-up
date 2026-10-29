/** Spanish labels for the exercise taxonomy (ADR-017). The API stores and returns the English slugs. */
export const MUSCLE_LABELS: Record<string, string> = {
  abdominals: 'Abdominales',
  abductors: 'Abductores',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Gemelos',
  cardio: 'Cardio',
  chest: 'Pecho',
  forearms: 'Antebrazos',
  full_body: 'Cuerpo completo',
  glutes: 'Glúteos',
  hamstrings: 'Femorales',
  lats: 'Dorsales',
  lower_back: 'Lumbar',
  neck: 'Cuello',
  quadriceps: 'Cuádriceps',
  shoulders: 'Hombros',
  traps: 'Trapecios',
  triceps: 'Tríceps',
  upper_back: 'Espalda alta',
  other: 'Otro',
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  machine: 'Máquina',
  cable: 'Polea',
  bodyweight: 'Peso corporal',
  kettlebell: 'Kettlebell',
  band: 'Banda',
  other: 'Otro',
};

export const TYPE_LABELS: Record<string, string> = {
  weight_reps: 'Peso y repeticiones',
  bodyweight_reps: 'Repeticiones con peso corporal',
  duration: 'Duración',
  distance_duration: 'Distancia y duración',
};

export const muscle = (slug: string): string => MUSCLE_LABELS[slug] ?? slug;
export const equipment = (slug: string): string => EQUIPMENT_LABELS[slug] ?? slug;
