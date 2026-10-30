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

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const TENS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

/** Reads one spelled-out number (0–999) starting at words[i]; returns its value and the words consumed. */
function readSpelledNumber(words: string[], i: number): { value: number; length: number } | null {
  let value = 0;
  let j = i;
  if (words[j]! in HUNDREDS) value += HUNDREDS[words[j++]!]!;
  if (j < words.length && words[j]! in TENS) {
    value += TENS[words[j++]!]!;
    if (words[j] === 'y' && j + 1 < words.length && words[j + 1]! in UNITS && UNITS[words[j + 1]!]! < 10) {
      value += UNITS[words[j + 1]!]!;
      j += 2;
    }
  } else if (j < words.length && words[j]! in UNITS) {
    value += UNITS[words[j++]!]!;
  }
  return j > i ? { value, length: j - i } : null;
}

/**
 * Offline recognisers (Vosk) spell numbers out: "treinta y dos coma cinco kilos" becomes "32,5 kilos".
 * Articles "un/una" stay words unless they sit right before a unit, so "una serie" is not rewritten.
 */
export function spelledNumbersToDigits(text: string): string {
  const words = text.split(' ');
  const out: string[] = [];
  for (let i = 0; i < words.length; ) {
    const whole = readSpelledNumber(words, i);
    const isArticle = whole && whole.length === 1 && ['un', 'una'].includes(words[i]!) && !/^(?:kilos?|kg|libras?|repeticiones?|reps?)$/.test(words[i + 1] ?? '');
    if (!whole || isArticle) {
      out.push(words[i++]!);
      continue;
    }
    i += whole.length;
    let number = String(whole.value);
    if ((words[i] === 'coma' || words[i] === 'punto') && i + 1 < words.length) {
      const decimal = readSpelledNumber(words, i + 1);
      if (decimal) {
        number += `,${decimal.value}`;
        i += 1 + decimal.length;
      }
    } else if (words[i] === 'y' && words[i + 1] === 'medio') {
      number += ',5';
      i += 2;
    }
    out.push(number);
  }
  return out.join(' ');
}

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

export function parseWorkoutVoiceCommand(input: string): WorkoutVoiceCommand | null {
  const text = spelledNumbersToDigits(normalize(input).replace(/(?<!\d)[.,:](?!\d)|[!?¿¡;]/g, ' ').replace(/\s+/g, ' ').trim());
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

  const setNumber = text.match(/\bseri[ea]\s*(\d+)\b/)?.[1];
  const repsMatch = text.match(/\b(\d+)\s*(?:repeticiones?|reps?|rex)\b/) ?? text.match(/\b(?:hice|he hecho|complete|registre)\s+(\d+)\b/);
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
