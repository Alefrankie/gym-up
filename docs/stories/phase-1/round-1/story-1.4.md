---
story_id: "1.4"
round: "round-1"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "draft"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking"]
  prd_requirements: []
  architecture_decisions: []
  flows: []
blocked_by: ["story-1.1"]
blocks: ["story-2.1"]
---

# Story 1.4 — Navigation + Layout Shell

Parent: [../readme.md](../readme.md)

## Summary

Create the navigation component and apply the layout to all pages. Uses the local stack — no Supabase.

## Happy Path

1. Create `src/components/navigation.astro` (kebab-case per [components.md](../../architecture/components.md#conventions)) with links: Home, History, Progress, Photos, Family, Settings.
2. Bottom nav on mobile, sidebar on desktop.
3. Active link highlighted.
4. Hidden on landing, login, register pages.
5. Apply `src/layouts/layout.astro` to all authenticated pages.

## Acceptance Criteria

- AC-1.4-01: Navigation shows all 6 links per [components.md](../../architecture/components.md).
- AC-1.4-02: Active link highlighted.
- AC-1.4-03: Responsive layout (bottom nav / sidebar).

## Tasks

- [ ] `T1.4-01` - Create `src/components/navigation.astro`
- [ ] `T1.4-02` - Add responsive styles
- [ ] `T1.4-03` - Create `src/layouts/layout.astro` and apply to authenticated pages
