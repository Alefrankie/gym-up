# Phase 1 Rounds

Parent: [../readme.md](../readme.md) · Phase: MVP

## Purpose

Rounds turn Phase 1 decisions into small implementation sub-phases that can be built and tested independently.

---

## Round Rule

A round must prove one testable capability. It is not a calendar sprint. It ends when its stories pass acceptance criteria and produce a working behavior.

---

## Story Rule

Each story file should keep this header order when possible:

- `## Summary`
- `## Happy Path`
- `## Acceptance Criteria`
- `## Tasks`
- `## Implementation Evidence` when done

Story files must link to source architecture docs instead of repeating decisions.

---

## Frontmatter Rule

```yaml
---
story_id: "1.1"
round: "round-1"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: ["FR-WT-001"]
  flows: ["start-workout.flow.md"]
blocked_by: []
blocks: ["story-1.2"]
---
```

Status values: `draft`, `ready`, `in-progress`, `blocked`, `completed`, `skipped`.

---

## Rounds

### Round 1 - Foundation

Goal: app boots locally with Astro + Supabase connection, auth works.

- [story-1.1.md](./round-1/story-1.1.md) - Project scaffold (Astro + Supabase + Vercel config)
- [story-1.2.md](./round-1/story-1.2.md) - Database schema + seed data migration
- [story-1.3.md](./round-1/story-1.3.md) - Auth (register + login + profile creation)
- [story-1.4.md](./round-1/story-1.4.md) - Navigation + layout shell

### Round 2 - Workout Core

Goal: user can start a workout, log sets, and complete it.

- [story-2.1.md](./round-2/story-2.1.md) - Dashboard (today's routine display)
- [story-2.2.md](./round-2/story-2.2.md) - Start workout (create workout record)
- [story-2.3.md](./round-2/story-2.3.md) - ExerciseCard (sets, reps, weight input)
- [story-2.4.md](./round-2/story-2.4.md) - Log set (auto-save entries)
- [story-2.5.md](./round-2/story-2.5.md) - Rest timer
- [story-2.6.md](./round-2/story-2.6.md) - Complete workout + summary

### Round 3 - Progress & History

Goal: user can view workout history and exercise progress charts.

- [story-3.1.md](./round-3/story-3.1.md) - Workout history page
- [story-3.2.md](./round-3/story-3.2.md) - Progress charts (Chart.js React island)
- [story-3.3.md](./round-3/story-3.3.md) - Calendar + streaks

### Round 4 - Family & Photos

Goal: family members can view each other's progress. Users can upload private photos.

- [story-4.1.md](./round-4/story-4.1.md) - Family view (list + member profile)
- [story-4.2.md](./round-4/story-4.2.md) - Private photos (upload + gallery)
- [story-4.3.md](./round-4/story-4.3.md) - Settings page (name, routine, unit toggle)

### Round 5 - Nutrition

Goal: user can take a photo of food, AI estimates calories and macros.

- [story-5.1.md](./round-5/story-5.1.md) - AI nutrition analysis endpoint
- [story-5.2.md](./round-5/story-5.2.md) - Meal photo capture + analysis UI
- [story-5.3.md](./round-5/story-5.3.md) - Nutrition history + daily summary
