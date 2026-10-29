/**
 * Share of a session each muscle takes: a set counts fully for the primary muscle and half for each secondary,
 * normalised so the most worked muscle reads 100 %.
 */
export interface LoadSource {
  muscleGroup: string;
  secondaryMuscles?: readonly string[];
  targetSets: number;
}

export function muscleLoad(exercises: readonly LoadSource[], max = 6): Array<{ muscle: string; pct: number }> {
  const load = new Map<string, number>();
  for (const e of exercises) {
    const sets = Math.max(e.targetSets, 1);
    load.set(e.muscleGroup, (load.get(e.muscleGroup) ?? 0) + sets);
    for (const m of e.secondaryMuscles ?? []) load.set(m, (load.get(m) ?? 0) + sets * 0.5);
  }
  const top = Math.max(1, ...load.values());
  return [...load.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([muscle, v]) => ({ muscle, pct: Math.round((v / top) * 100) }));
}
