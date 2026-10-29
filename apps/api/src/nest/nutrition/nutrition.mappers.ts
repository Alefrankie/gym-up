import type { NutritionEntry } from '@db/schema';
import type { MealAnalysisDto, NutritionEntryDto } from '@gym-up/contracts';
import type { AIAnalysisResult, FoodItem, PhotoFormat } from '@/lib/contexts/nutrition/domain/nutrition.types';

export const FORMAT_BY_MIME: Readonly<Record<string, PhotoFormat>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const toAnalysisDto = (r: AIAnalysisResult): MealAnalysisDto => ({
  totalCalories: r.total_calories,
  totalProtein: r.total_protein,
  totalCarbs: r.total_carbs,
  totalFat: r.total_fat,
  foodItems: r.food_items.map((f) => ({
    name: f.name,
    calories: f.estimated_calories,
    protein: f.estimated_protein,
    carbs: f.estimated_carbs,
    fat: f.estimated_fat,
  })),
});

export const toFoodItems = (dto: MealAnalysisDto): FoodItem[] =>
  dto.foodItems.map((f) => ({
    name: f.name,
    estimated_calories: f.calories,
    estimated_protein: f.protein,
    estimated_carbs: f.carbs,
    estimated_fat: f.fat,
  }));

function parseItems(json: string): MealAnalysisDto['foodItems'] {
  try {
    const items = JSON.parse(json) as FoodItem[];
    return items.map((f) => ({
      name: f.name,
      calories: f.estimated_calories,
      protein: f.estimated_protein,
      carbs: f.estimated_carbs,
      fat: f.estimated_fat,
    }));
  } catch {
    return [];
  }
}

export const toEntryDto = (e: NutritionEntry): NutritionEntryDto => ({
  id: e.id,
  loggedAt: e.photoDate.toISOString(),
  totalCalories: e.totalCalories,
  totalProtein: e.totalProtein,
  totalCarbs: e.totalCarbs,
  totalFat: e.totalFat,
  foodItems: parseItems(e.foodItems),
  userEdited: e.userEdited,
  hasPhoto: e.storagePath !== '',
});

/** Decodes base64 without Node's Buffer-only helpers being required (works in Workers too). */
export function decodeBase64(data: string): Uint8Array {
  const clean = data.replace(/^data:[^;]+;base64,/, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
