// Recipe book helpers (DR-0029): shared by the list, the detail and the editor.
//
// Photos need the bearer token, so they load as blobs through the API client. The bytes are also kept in
// IndexedDB: a recipe opened once must still show its photos in a kitchen with no signal, which is the
// normal condition there.

import { fetchBlob } from '#lib/api/binary';
import { NetworkError } from '#lib/api/errors';
import { dateLocale, type MessageKey } from '#lib/i18n';
import { kv } from '#lib/offline/idb';
import type { RecipeTag } from '@gym-up/contracts';

const photoUrls = new Map<string, Promise<string>>();
const photoKey = (photoId: string) => `recipe-photo:${photoId}`;

async function loadPhoto(recipeId: string, photoId: string): Promise<string> {
  try {
    const blob = await fetchBlob(`/recipes/${recipeId}/photos/${photoId}/file`);
    // Not awaited: the screen shows the photo now and the offline copy is a bonus.
    void kv.set(photoKey(photoId), blob).catch(() => undefined);
    return URL.createObjectURL(blob);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    const saved = await kv.get<Blob>(photoKey(photoId));
    if (!saved) throw e;
    return URL.createObjectURL(saved);
  }
}

/** Object URL for one recipe photo, fetched once per session. */
export function recipePhotoUrl(recipeId: string, photoId: string): Promise<string> {
  let url = photoUrls.get(photoId);
  if (!url) {
    url = loadPhoto(recipeId, photoId);
    url.catch(() => photoUrls.delete(photoId));
    photoUrls.set(photoId, url);
  }
  return url;
}

/** After replacing a photo the old object URL points at bytes the server already deleted. */
export function forgetRecipePhoto(photoId: string): void {
  const url = photoUrls.get(photoId);
  photoUrls.delete(photoId);
  url?.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
  void kv.delete(photoKey(photoId)).catch(() => undefined);
}

/** Spanish writes 4,5 and English 4.5; `digits` caps the decimals shown. */
export function num(value: number, digits = 0): string {
  return value.toLocaleString(dateLocale(), { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/** Ingredient amounts scale with the servings the cook picked. One decimal is plenty for a kitchen. */
export function scaled(quantity: number, factor: number): number {
  return Math.round(quantity * factor * 10) / 10;
}

/** "400 g", "1 limón", or "al gusto" when the amount was never numeric. */
export function amount(quantity: number | null, unit: string | null, toTaste: string): string {
  if (quantity === null) return toTaste;
  return unit ? `${num(quantity, 1)} ${unit}` : num(quantity, 1);
}

/** "hace 3 días" / "3 days ago" for the last week, then a plain date. */
export function relativeWhen(iso: string): string {
  const then = new Date(iso);
  const days = Math.round((then.getTime() - Date.now()) / 86_400_000);
  if (Math.abs(days) <= 6) {
    return new Intl.RelativeTimeFormat(dateLocale(), { numeric: 'auto' }).format(days, 'day');
  }
  const sameYear = then.getFullYear() === new Date().getFullYear();
  return then.toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export const tagKey = (tag: RecipeTag): MessageKey => `recipes.tag.${tag}` as MessageKey;

/** Order the editor shows the tags in. */
export const RECIPE_TAGS: readonly RecipeTag[] = [
  'alto-proteina',
  'sin-horno',
  'air-fryer',
  'vegetariana',
  'vegana',
  'sin-lactosa',
  'meal-prep',
  'desayuno',
  'snack',
];

/** Only the three content types the API accepts; a canvas re-encode always produces JPEG. */
export function photoMime(blob: Blob): 'image/jpeg' | 'image/png' | 'image/webp' {
  return blob.type === 'image/png' || blob.type === 'image/webp' ? blob.type : 'image/jpeg';
}

/**
 * One "Añadir a hoy" attempt. The id is minted when the sheet opens and reused on every retry, so a
 * response lost after the write returns the same entry instead of logging the meal twice.
 */
export interface RecipeLogAttempt {
  entryId: string;
  servings: number;
}

export function newLogAttempt(): RecipeLogAttempt {
  return { entryId: crypto.randomUUID(), servings: 1 };
}

/**
 * Sends the attempt to `POST /recipes/:id/log`. Retrying the same attempt is safe on purpose: that is what
 * turns a lost response into a no-op. Opening the sheet again mints a new id, which is how a member logs
 * the same recipe twice on purpose.
 */
export async function sendLogAttempt(
  attempt: RecipeLogAttempt,
  send: (body: { id: string; servings: number }) => Promise<unknown>,
): Promise<void> {
  await send({ id: attempt.entryId, servings: attempt.servings });
}
