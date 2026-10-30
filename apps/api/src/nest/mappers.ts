import type { Profile, Workout, WorkoutEntry } from '@db/schema';
import type { User } from '@/lib/contexts/auth/auth.types';
import type {
  UserDto,
  WorkoutDto,
  WorkoutEntryDto,
} from '@gym-up/contracts';

const iso = (d: Date) => d.toISOString();

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    routineType: u.routineType,
    weightUnit: u.weightUnit,
    bodyWeightKg: u.bodyWeightKg ?? null,
    coachTone: u.coachTone ?? 'normal',
    addressForm: u.addressForm ?? 'neutral',
    createdAt: iso(u.createdAt),
  };
}

export function profileToUserDto(p: Profile): UserDto {
  return {
    id: p.id,
    email: p.email,
    displayName: p.displayName,
    routineType: p.routineType,
    weightUnit: p.weightUnit,
    bodyWeightKg: p.bodyWeightKg ?? null,
    coachTone: p.coachTone,
    addressForm: p.addressForm,
    createdAt: iso(p.createdAt),
  };
}

export function toWorkoutDto(w: Workout): WorkoutDto {
  return {
    id: w.id,
    userId: w.userId,
    routineDayId: w.routineDayId,
    workoutDate: iso(w.workoutDate),
    status: w.status,
    startedAt: iso(w.startedAt),
    completedAt: w.completedAt ? iso(w.completedAt) : null,
  };
}

export function toWorkoutEntryDto(e: WorkoutEntry): WorkoutEntryDto {
  return {
    id: e.id,
    workoutId: e.workoutId,
    exerciseId: e.exerciseId,
    setNumber: e.setNumber,
    reps: e.reps,
    weight: e.weight,
    completed: e.completed,
    notes: e.notes,
    setType: e.setType,
    createdAt: iso(e.createdAt),
  };
}
