import { z } from 'zod';

/** Client-generated UUID (ADR-025: every created entity gets its id on the client). */
export const idSchema = z.string().uuid();

/** Kind of set. Warm-ups do not count toward volume. */
export const setTypeSchema = z.enum(['normal', 'warmup', 'drop', 'failure']);
export type SetType = z.infer<typeof setTypeSchema>;

/** Per-set plan of a routine exercise: reps, kind and (optionally) target weight in kg of each set, in order. */
export const setPlanSchema = z
  .array(z.object({ reps: z.number().int().min(1).max(100), type: setTypeSchema.default('normal'), weight: z.number().min(0).max(500).optional() }))
  .min(1)
  .max(20);
export type SetPlan = z.infer<typeof setPlanSchema>;

export const weightUnitSchema = z.enum(['kg', 'lbs']);
export type WeightUnit = z.infer<typeof weightUnitSchema>;

export const routineTypeSchema = z.enum(['hombre', 'mujer']);
export type RoutineType = z.infer<typeof routineTypeSchema>;

/** Coach personality. `gymrat` is opt-in and Spanish only. */
export const coachToneSchema = z.enum(['flower', 'normal', 'gymrat']);
export type CoachTone = z.infer<typeof coachToneSchema>;

/** How the coach addresses the user in Spanish (grammatical gender): as a man or as a woman. */
export const addressFormSchema = z.enum(['m', 'f']);
export type AddressForm = z.infer<typeof addressFormSchema>;

/** ISO-8601 timestamp as sent over the wire. */
export const isoDateSchema = z.string().datetime();

/** Error body returned by the API for every non-2xx response. */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  error: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
