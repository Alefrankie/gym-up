import { describe, expect, it } from 'vitest';
import { registerRequestSchema, upsertSetRequestSchema, startWorkoutRequestSchema } from './index';

describe('contracts', () => {
  it('rejects a short password on register', () => {
    const r = registerRequestSchema.safeParse({
      email: 'a@b.co',
      password: 'short',
      displayName: 'A',
      routineType: 'hombre',
    });
    expect(r.success).toBe(false);
  });

  it('defaults weightUnit to kg on register', () => {
    const r = registerRequestSchema.parse({
      email: 'a@b.co',
      password: 'longenough',
      displayName: 'A',
      routineType: 'mujer',
    });
    expect(r.weightUnit).toBe('kg');
  });

  it('requires a client-generated uuid for sets (idempotent upsert)', () => {
    const base = { exerciseId: 'e1', setNumber: 1, reps: 10, weight: 50, weightUnit: 'kg' };
    expect(upsertSetRequestSchema.safeParse({ ...base, id: 'not-a-uuid' }).success).toBe(false);
    expect(upsertSetRequestSchema.safeParse({ ...base, id: crypto.randomUUID() }).success).toBe(true);
  });

  it('start workout needs a uuid id', () => {
    expect(startWorkoutRequestSchema.safeParse({ id: 'x', routineDayId: 'd1' }).success).toBe(false);
  });
});
