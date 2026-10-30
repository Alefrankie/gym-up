import { describe, expect, it } from 'vitest';
import { parseWorkoutVoiceCommand } from './voice-assistant';

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
