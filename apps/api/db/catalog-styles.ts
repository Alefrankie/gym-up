// Which catalog exercises belong to a training-style collection. A style is not equipment: every exercise here
// keeps its own `equipment` value, so a pull-up stays "bar" and a band-assisted pull-up stays "band".
//
// The list is curated by hand on purpose. Tagging every `bodyweight` row would drag in mobility and
// rehab drills (prone scapular raises, bird dog, dead bug), plain cardio (running, jumping jacks) and
// apparatus work (stability ball, medicine ball, sled), none of which belong in the collection.

/**
 * Calisthenics: bodyweight strength movements and their progressions — pushing, pulling, dips, holds,
 * single-leg work — plus the weighted and band-assisted versions of those same movements.
 */
export const CALISTHENICS: readonly string[] = [
  // Push: floor and parallel bars
  'Push Up',
  'Knee Push Up',
  'Incline Push Up',
  'Decline Push Up',
  'Wide Push Up',
  'Diamond Push Up',
  'Plyometric Push Up',
  'Weighted Push Up',
  'Pike Push Up',
  'Handstand Push Up',
  'Chest Dip',
  'Tricep Dip',
  'Bench Dip',
  'Ring Dip',
  'Weighted Dip',

  // Pull: bar and rings
  'Pull Up',
  'Chin Up',
  'Wide Grip Pull Up',
  'Neutral Grip Pull Up',
  'Weighted Pull Up',
  'Band Assisted Pull Up',
  'Scapular Pull Up',
  'Muscle Up',
  'Inverted Row',
  'Dead Hang',

  // Back on the floor, for people without a bar
  'Superman',
  'Prone Cobra',
  'Back Extension',

  // Core: holds and hanging work
  'Plank',
  'Side Plank',
  'Hollow Body Hold',
  'Hanging Leg Raise',
  'Hanging Knee Raise',
  "Captain's Chair Knee Raise",
  'Toes to Bar',
  'Lying Leg Raise',
  'V-Up',
  'Sit Up',
  'Crunches',
  'Reverse Crunch',
  'Bicycle Crunch',
  'Russian Twist',

  // Legs
  'Bodyweight Squat',
  'Jump Squat',
  'Pistol Squat',
  'Sissy Squat',
  'Wall Sit',
  'Nordic Hamstring Curl',
  'Reverse Nordic',
  'Glute Bridge',
  'Single Leg Glute Bridge',
  'Single Leg Hip Thrust',
];

/** Style collections per exercise name; names with no collection are simply absent. */
export const STYLES_BY_NAME: ReadonlyMap<string, string[]> = new Map(CALISTHENICS.map((name) => [name, ['calisthenics']]));
