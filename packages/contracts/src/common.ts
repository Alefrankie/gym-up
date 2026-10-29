import { z } from 'zod';

/** Client-generated UUID (ADR-025: every created entity gets its id on the client). */
export const idSchema = z.string().uuid();

export const weightUnitSchema = z.enum(['kg', 'lbs']);
export type WeightUnit = z.infer<typeof weightUnitSchema>;

export const routineTypeSchema = z.enum(['hombre', 'mujer']);
export type RoutineType = z.infer<typeof routineTypeSchema>;

/** ISO-8601 timestamp as sent over the wire. */
export const isoDateSchema = z.string().datetime();

/** Error body returned by the API for every non-2xx response. */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  error: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
