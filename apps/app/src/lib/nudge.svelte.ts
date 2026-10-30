import { i18n } from '#lib/i18n';

/** A short, friendly pop-up line at the top of the screen (one at a time, gone in a few seconds). */
class Nudge {
  text = $state<string | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;

  show(text: string, ms = 2800) {
    clearTimeout(this.#timer);
    this.text = text;
    navigator.vibrate?.([8, 40, 8]);
    this.#timer = setTimeout(() => (this.text = null), ms);
  }

  hide() {
    clearTimeout(this.#timer);
    this.text = null;
  }
}

export const nudge = new Nudge();

// Teasing, never mean: lowering the weight is often the smart call.
const LOWER_ES = [
  '¡AAAY VALEEE, le vas a bajar pesooo! 👀',
  '¿Menos peso? Tranqui, la técnica también cuenta… pero te estoy viendo.',
  'Bajando kilos… ¿estamos en modo descarga o en modo pereza? 😏',
  'La barra te extraña más pesada, pero vale, hoy mandas tú.',
  '¿Y ese peso pluma? Bueno, bueno, lo importante es venir.',
  'Ojito: la última vez levantaste más. Tu yo del pasado te saluda.',
  'Hoy toca versión light. Que no se entere tu récord.',
  'Menos peso, más reps, más estilo. Eso nos decimos.',
  '¡Ese peso está de oferta! Mitad de esfuerzo, toda la dignidad.',
  'Vale, vale, nadie ha visto nada. 🤫',
];
const LOWER_EN = [
  'Ayyy, going lighter today, are we?! 👀',
  'Less weight? Form matters… but I saw that.',
  'Dropping kilos… deload mode or lazy mode? 😏',
  'The bar misses being heavier, but fine, you’re the boss today.',
  'Featherweight edition! Hey, showing up is what counts.',
  'Psst: last time you lifted more. Past you says hi.',
  'Light version today. Don’t tell your PR.',
  'Less weight, more reps, more style. That’s our story.',
  'This weight is on sale! Half the effort, all the dignity.',
  'Okay, okay, nobody saw anything. 🤫',
];

/** Call when a weight goes below the last one used: shows a playful line. */
export function teaseLowerWeight() {
  const list = i18n.locale === 'en' ? LOWER_EN : LOWER_ES;
  nudge.show(list[Math.floor(Math.random() * list.length)]!);
}
