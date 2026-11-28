---
id: DR-0034
title: Recover missing exercise history during a live workout
status: proposed
tier: 1
date: 2026-11-28
owner: "@alefrank"
deciders: ["@alefrank"]
scope: local
reversibility: easy
risk_flags: []
depends_on: [DR-0025]
links:
  code:
    - apps/api/src/nest/workouts/workouts.controller.ts
    - apps/app/src/lib/offline/workout-view.svelte.ts
validation:
  criteria:
    - The live workout can retrieve the signed-in user's earlier sets when the routine did not supply them.
    - History arriving late does not replace edited or completed sets.
---

# Recover missing exercise history during a live workout

An exercise added, replaced, or restored without routine metadata has no
previous-session data in the local snapshot. Reuse the routine's existing
history lookup in an authenticated, read-only fallback by exercise. Use the
workout day as a cutoff so the active session cannot suggest its own sets.
Leave offline snapshots usable and only prefill rows still awaiting a suggestion.
