import { startWorkoutResponseSchema } from '@gym-up/contracts';
import { api } from '../api/client';
import type { Command, Sender } from './outbox';

/** Sends one command to the API. Every endpoint is idempotent, so a replay never duplicates data. */
export const sendCommand: Sender = async (command: Command) => {
  switch (command.type) {
    case 'start-workout': {
      const res = await api('/workouts', {
        body: { id: command.id, routineDayId: command.routineDayId, ...(command.date ? { date: command.date } : {}) },
        schema: startWorkoutResponseSchema,
      });
      // One workout per user per day: if the server already had one, our local id is replaced by its id.
      if (res.workout.id !== command.id) return { remap: { from: command.id, to: res.workout.id } };
      return;
    }
    case 'upsert-set':
      await api(`/workouts/${command.workoutId}/sets`, { method: 'PUT', body: command.set });
      return;
    case 'remove-set':
      await api(`/workouts/${command.workoutId}/sets/${command.exerciseId}/${command.setNumber}`, { method: 'DELETE' });
      return;
    case 'discard-workout':
      await api(`/workouts/${command.workoutId}`, { method: 'DELETE' });
      return;
    case 'finish-workout':
      await api(`/workouts/${command.workoutId}/complete`, {
        method: 'POST',
        body: command.durationSeconds ? { durationSeconds: command.durationSeconds } : undefined,
      });
      return;
    case 'mark-supplement':
      await api(`/supplements/${command.supplementId}/log`, { method: 'PUT', body: { day: command.day, taken: command.taken } });
      return;
  }
};
