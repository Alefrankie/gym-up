export type WorkoutVoiceCommand =
  | { type: 'log-set'; setNumber?: number; reps: number; weight?: number; weightUnit?: 'kg' | 'lbs' }
  | { type: 'next-exercise' }
  | { type: 'mark-supplement'; query: string };

function normalize(text: string): string {
  return text
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

export function parseWorkoutVoiceCommand(input: string): WorkoutVoiceCommand | null {
  const text = normalize(input);
  if (!text) return null;

  const supplement = text.match(/\b(?:ya\s+)?(?:me\s+)?(?:tome|he tomado|consumi)\s+(?:el\s+|la\s+|mi\s+)?(.+?)(?:\s+de hoy|\s+hoy)?[.!]?$/);
  if (supplement) {
    const query = supplement[1]!
      .replace(/\b(?:suplemento|suplementos|de hoy)\b/g, '')
      .replace(/^(?:el|la|mi)\s+/, '')
      .trim();
    return { type: 'mark-supplement', query };
  }

  if (/\b(?:siguiente ejercicio|proximo ejercicio|pasa al siguiente|vamos con el siguiente|vamos al siguiente|termine este ejercicio|termine el ejercicio|acabe este ejercicio|acabe el ejercicio)\b/.test(text)) {
    return { type: 'next-exercise' };
  }

  const setNumber = text.match(/\bserie\s*(\d+)\b/)?.[1];
  const repsMatch = text.match(/\b(\d+)\s*(?:repeticiones?|reps?)\b/) ?? text.match(/\b(?:hice|he hecho|complete|registre)\s+(\d+)\b/);
  if (!repsMatch) return null;

  const weightMatch = text.match(/\b(?:con|a)\s*(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilogramos?|lbs?|libras?)\b/);
  const weight = weightMatch ? parseNumber(weightMatch[1]!) : undefined;
  const weightUnit = weightMatch ? (/^(?:lb|lbs|libra|libras)$/.test(weightMatch[2]!) ? 'lbs' : 'kg') : undefined;
  return {
    type: 'log-set',
    ...(setNumber ? { setNumber: Number(setNumber) } : {}),
    reps: Number(repsMatch[1]),
    ...(weight !== undefined ? { weight, weightUnit } : {}),
  };
}

export function normalizeSupplementName(name: string): string {
  return normalize(name).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
