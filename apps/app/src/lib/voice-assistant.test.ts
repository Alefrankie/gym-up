import { describe, expect, it } from 'vitest';
import { matchSpokenExercise, parseWorkoutVoiceCommand } from './voice-assistant';

describe('spelled-out numbers (Vosk output)', () => {
  it('reads reps and weight written as words', () => {
    expect(parseWorkoutVoiceCommand('hice diez repeticiones con ochenta kilos')).toEqual({
      type: 'log-set',
      reps: 10,
      weight: 80,
      weightUnit: 'kg',
    });
  });

  it('reads compound numbers, decimals and the set number', () => {
    expect(parseWorkoutVoiceCommand('serie uno hice ocho rex con treinta y dos coma cinco kilos')).toEqual({
      type: 'log-set',
      setNumber: 1,
      reps: 8,
      weight: 32.5,
      weightUnit: 'kg',
    });
  });

  it('reads "y medio", hundreds and a trailing set number', () => {
    expect(parseWorkoutVoiceCommand('hice doce repeticiones con ciento veinte y medio kilos en la serie dos')).toEqual({
      type: 'log-set',
      setNumber: 2,
      reps: 12,
      weight: 120.5,
      weightUnit: 'kg',
    });
  });

  it('accepts the mishearings recorded on the phone ("se dio", "y si", "como")', () => {
    expect(parseWorkoutVoiceCommand('se dio una y se ocho repeticiones con 32.5 kilos')).toEqual({
      type: 'log-set',
      setNumber: 1,
      reps: 8,
      weight: 32.5,
      weightUnit: 'kg',
    });
    expect(parseWorkoutVoiceCommand('Y sí, 10 repeticiones como 80 kilos.')).toEqual({
      type: 'log-set',
      reps: 10,
      weight: 80,
      weightUnit: 'kg',
    });
  });

  it('accepts Whisper mishearing "serie" as "sería"', () => {
    expect(parseWorkoutVoiceCommand('Sería 1. Hice 8 reps con 32,5 kg.')).toEqual({
      type: 'log-set',
      setNumber: 1,
      reps: 8,
      weight: 32.5,
      weightUnit: 'kg',
    });
  });
});

describe('parseWorkoutVoiceCommand', () => {
  it('parses a spoken set with reps and metric weight', () => {
    expect(parseWorkoutVoiceCommand('Hice 10 repeticiones con 80 kilos')).toEqual({
      type: 'log-set',
      reps: 10,
      weight: 80,
      weightUnit: 'kg',
    });
  });

  it('keeps the explicitly named set number', () => {
    expect(parseWorkoutVoiceCommand('Serie 2, hice 8 reps con 32,5 kg')).toEqual({
      type: 'log-set',
      setNumber: 2,
      reps: 8,
      weight: 32.5,
      weightUnit: 'kg',
    });
  });

  it('parses imperial weights', () => {
    expect(parseWorkoutVoiceCommand('12 reps con 45 libras')).toEqual({
      type: 'log-set',
      reps: 12,
      weight: 45,
      weightUnit: 'lbs',
    });
  });

  it('recognizes advancing after finishing an exercise', () => {
    expect(parseWorkoutVoiceCommand('Terminé este ejercicio')).toEqual({ type: 'next-exercise' });
    expect(parseWorkoutVoiceCommand('Siguiente ejercicio')).toEqual({ type: 'next-exercise' });
    expect(parseWorkoutVoiceCommand('Ya terminé este ejercicio, vamos con el siguiente')).toEqual({ type: 'next-exercise' });
  });

  it('captures a supplement name without making an unsafe guess', () => {
    expect(parseWorkoutVoiceCommand('Ya me tomé la creatina de hoy')).toEqual({
      type: 'mark-supplement',
      query: 'creatina',
    });
    expect(parseWorkoutVoiceCommand('Ya me tomé el suplemento de hoy')).toEqual({
      type: 'mark-supplement',
      query: '',
    });
  });

  it('does not infer an action from unrelated or incomplete speech', () => {
    expect(parseWorkoutVoiceCommand('sube el peso la próxima vez')).toBeNull();
    expect(parseWorkoutVoiceCommand('hice unas cuantas')).toBeNull();
    expect(parseWorkoutVoiceCommand('una serie mas')).toBeNull();
  });
});

describe('exercise names by voice', () => {
  const session = [
    'Bench Press',
    'Shoulder Press',
    'Squat',
    'Bulgarian Squat',
    'Lat Pulldown',
    'Hip Thrust',
    'Romanian Deadlift',
    'Hammer Curl',
    'My Custom Thing',
  ].map((exerciseName) => ({ exerciseId: exerciseName, exerciseName }));
  const pick = (query: string) => {
    const m = matchSpokenExercise(query, session);
    return m.kind === 'match' ? m.exercise.exerciseName : m.kind === 'ambiguous' ? m.options.map((o) => o.exerciseName) : null;
  };

  it('parses going to a named exercise', () => {
    expect(parseWorkoutVoiceCommand('Vamos con press de banca')).toEqual({ type: 'go-to-exercise', query: 'press de banca' });
    expect(parseWorkoutVoiceCommand('cambia a la sentadilla búlgara')).toEqual({ type: 'go-to-exercise', query: 'sentadilla bulgara' });
    expect(parseWorkoutVoiceCommand('Ahora toca jalón al pecho.')).toEqual({ type: 'go-to-exercise', query: 'jalon al pecho' });
    expect(parseWorkoutVoiceCommand('vamos con el siguiente')).toEqual({ type: 'next-exercise' });
  });

  it('parses the exercise named with a set', () => {
    expect(parseWorkoutVoiceCommand('Hice 10 repeticiones de press de banca con 60 kilos')).toEqual({
      type: 'log-set',
      reps: 10,
      weight: 60,
      weightUnit: 'kg',
      exercise: 'press de banca',
    });
    expect(parseWorkoutVoiceCommand('doce reps en sentadilla')).toEqual({ type: 'log-set', reps: 12, exercise: 'sentadilla' });
    expect(parseWorkoutVoiceCommand('Hice 10 repeticiones con 80 kilos')).not.toHaveProperty('exercise');
  });

  it('matches Spanish names, aliases and English names', () => {
    expect(pick('press de banca')).toBe('Bench Press');
    expect(pick('press militar')).toBe('Shoulder Press');
    expect(pick('jalón al pecho')).toBe('Lat Pulldown');
    expect(pick('peso muerto rumano')).toBe('Romanian Deadlift');
    expect(pick('curl martillo')).toBe('Hammer Curl');
    expect(pick('hip thrust')).toBe('Hip Thrust');
    expect(pick('bench press')).toBe('Bench Press');
    expect(pick('my custom thing')).toBe('My Custom Thing');
  });

  it('tolerates speech-to-text slips', () => {
    expect(pick('pres de vanca')).toBe('Bench Press');
    expect(pick('sentadiya bulgara')).toBe('Bulgarian Squat');
    expect(pick('escuat')).toBe('Squat');
    expect(pick('jip trust')).toBe('Hip Thrust');
    expect(pick('halon al pecho')).toBe('Lat Pulldown');
    expect(pick('el ejercicio de rumano')).toBe('Romanian Deadlift');
  });

  it('asks instead of guessing when two exercises fit', () => {
    expect(pick('press')).toEqual(expect.arrayContaining(['Bench Press', 'Shoulder Press']));
  });

  it('finds nothing for unrelated words', () => {
    expect(pick('bicicleta')).toBeNull();
    expect(pick('hola que tal')).toBeNull();
  });
});
