import { z } from 'zod';
import { addressFormSchema, coachToneSchema, isoDateSchema, routineTypeSchema, weightUnitSchema } from './common';

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80),
  routineType: routineTypeSchema,
  weightUnit: weightUnitSchema.default('kg'),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  routineType: routineTypeSchema,
  weightUnit: weightUnitSchema,
  /** For calorie estimates; null until set. */
  bodyWeightKg: z.number().nullable().optional(),
  coachTone: coachToneSchema.default('normal'),
  addressForm: addressFormSchema.default('neutral'),
  /** Can manage feedback and record the Coach's lines in the voice studio. */
  isAdmin: z.boolean().default(false),
  createdAt: isoDateSchema,
});
export type UserDto = z.infer<typeof userSchema>;

/** Returned by register and login. `token` is an opaque bearer session token. */
export const sessionResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: isoDateSchema,
  user: userSchema,
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const updateProfileRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    weightUnit: weightUnitSchema.optional(),
    bodyWeightKg: z.number().min(25).max(300).nullable().optional(),
    routineType: routineTypeSchema.optional(),
    coachTone: coachToneSchema.optional(),
    addressForm: addressFormSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
