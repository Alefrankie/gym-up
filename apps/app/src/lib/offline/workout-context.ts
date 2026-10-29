import { getContext, setContext } from 'svelte';
import type { WorkoutView } from './workout-view.svelte';

const KEY = Symbol('workout-view');

/** The workout layout creates one view and every screen under `/workout/[id]` reads the same one. */
export const provideWorkoutView = (view: WorkoutView) => setContext(KEY, view);
export const useWorkoutView = (): WorkoutView => getContext<WorkoutView>(KEY);
