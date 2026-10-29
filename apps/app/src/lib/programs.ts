import type { ProgramDetailDto, SaveProgramRequest } from '@gym-up/contracts';

/** Rebuilds the full `PUT /programs/:id` body from a loaded program, with some parts replaced. */
export function saveBody(
  detail: ProgramDetailDto,
  patch: { name?: string; routines?: ProgramDetailDto['routines'] } = {},
): SaveProgramRequest {
  return {
    name: patch.name ?? detail.name,
    description: detail.description,
    routines: (patch.routines ?? detail.routines).map((r) => ({
      id: r.id,
      name: r.name,
      focus: r.focus,
      notes: r.notes,
      exercises: r.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        warmupSets: e.warmupSets,
        restSeconds: e.restSeconds,
        notes: e.notes,
        sets: e.sets ?? null,
      })),
    })),
  };
}
