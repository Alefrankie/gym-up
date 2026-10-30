import { describe, expect, it } from 'vitest';
import type { LibraryExerciseDto } from '@gym-up/contracts';
import { emptyFilter, filterExercises } from './exercise-filter';

const ex = (name: string, primaryMuscle: string, equipment: string, secondaryMuscles: string[] = []): LibraryExerciseDto => ({
  id: name,
  name,
  primaryMuscle,
  secondaryMuscles,
  equipment,
  exerciseType: 'weight_reps',
  instructions: null,
  videoUrl: null,
  isCustom: false,
  ownerId: null,
  isArchived: false,
});

const ALL = [
  ex('Bench Press', 'chest', 'barbell', ['triceps']),
  ex('Dumbbell Bench Press', 'chest', 'dumbbell'),
  ex('Squat', 'quadriceps', 'barbell', ['glutes']),
  ex('Bulgarian Squat', 'quadriceps', 'dumbbell'),
  ex('Hammer Curl', 'biceps', 'dumbbell'),
  ex('Lat Pulldown', 'lats', 'cable'),
  ex('Push Up', 'chest', 'bodyweight'),
  ex('Romanian Deadlift', 'hamstrings', 'barbell'),
  ex('My Weird Move', 'other', 'other'),
];

const names = (q: string, f = {}) => filterExercises(ALL, { ...emptyFilter(), ...f, q }).map((e) => e.name);

describe('exercise search', () => {
  it('finds exercises by their Spanish name and aliases', () => {
    expect(names('sentadilla')).toEqual(expect.arrayContaining(['Squat', 'Bulgarian Squat']));
    expect(names('press de banca')[0]).toBe('Bench Press');
    expect(names('lagartijas')).toEqual(['Push Up']);
    expect(names('jalon')).toEqual(['Lat Pulldown']);
    expect(names('rumano')).toEqual(['Romanian Deadlift']);
  });

  it('ignores accents and case', () => {
    expect(names('SENTADILLA BÚLGARA')[0]).toBe('Bulgarian Squat');
    expect(names('jalón')).toEqual(['Lat Pulldown']);
  });

  it('tolerates typos', () => {
    expect(names('sentadila')).toContain('Squat');
    expect(names('press banka')[0]).toBe('Bench Press');
    expect(names('hamer curl')).toEqual(['Hammer Curl']);
  });

  it('still finds English names and custom exercises', () => {
    expect(names('bench')).toEqual(['Bench Press', 'Dumbbell Bench Press']);
    expect(names('weird')).toEqual(['My Weird Move']);
  });

  it('understands muscles and equipment written as words', () => {
    expect(names('pecho')).toEqual(expect.arrayContaining(['Bench Press', 'Dumbbell Bench Press', 'Push Up']));
    expect(names('pecho mancuerna')).toEqual(['Dumbbell Bench Press']);
    expect(names('biceps')).toEqual(['Hammer Curl']);
  });

  it('ranks the closest name first', () => {
    expect(names('squat')[0]).toBe('Squat');
    expect(names('press banca')[0]).toBe('Bench Press');
  });

  it('keeps the muscle and equipment filters', () => {
    expect(names('', { muscle: 'glutes' })).toEqual(['Squat']);
    expect(names('press', { equipment: 'dumbbell' })).toEqual(['Dumbbell Bench Press']);
  });

  it('orders by the shown name when there is no query', () => {
    const shown = filterExercises(ALL.slice(0, 3), emptyFilter(), (e) => ({ 'Bench Press': 'Z', 'Dumbbell Bench Press': 'A', Squat: 'M' })[e.name]!);
    expect(shown.map((e) => e.name)).toEqual(['Dumbbell Bench Press', 'Squat', 'Bench Press']);
  });

  it('returns nothing for gibberish', () => {
    expect(names('xyzzy')).toEqual([]);
  });
});
