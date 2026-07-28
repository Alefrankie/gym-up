---
story_id: "1.4"
round: "round-1"
parent_spec: "../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "completed"
started: "2026-07-28"
completed: "2026-07-28"
owner: "crew-flow"
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

- [x] `T1.4-01` - Create `src/components/navigation.astro`
- [x] `T1.4-02` - Add responsive styles
- [x] `T1.4-03` - Create `src/layouts/app-layout.astro` and apply to authenticated pages (amended: separate from `layout.astro` per user decision)

## Implementation Evidence

**Files created:**
- `src/components/navigation.astro` (139 lines) — 6 links per `docs/architecture/components.md`, exact-match active state via `aria-current="page"` + `.active`, accessible (`aria-label`, `aria-hidden` on decorative icons, `role="list"`), responsive (bottom-nav < 768px / sidebar ≥ 768px), `prefers-reduced-motion` honored.
- `src/layouts/app-layout.astro` (60 lines, renamed from `AppLayout.astro` per Fely convention check) — shell for authenticated pages, reads `Astro.url.pathname` server-side, padding adjusted to clear bottom-nav on mobile, `safe-area-inset-bottom` for iOS notch.

**Files modified:**
- `src/pages/dashboard.astro` — import changed to `app-layout.astro`, wrapper changed to `<AppLayout>`, removed redundant `padding: 2rem` from `.dashboard-container` (AppLayout provides it).

**Files unchanged (legacy preserved):**
- `src/layouts/layout.astro` (marketing shell)
- `src/pages/index.astro`, `login.astro`, `register.astro`, `logout.astro`

**Verification:**
- `npm run typecheck` (astro check) — 0 errors in touched files
- `npm run test:run` — 54/54 pass, 0 regressions
- `npm run build` (astro build) — complete in 3.81s, SSR verified
- `npm run dev` — visual verification pending Fely (Phase 4 GAPs documented in `session.1.4.md`)

**Amendments:**
- Q1 (user): Created separate `AppLayout.astro` (later renamed to `app-layout.astro`) instead of extending `layout.astro`. This overrides the literal AC "Apply `src/layouts/layout.astro` to all authenticated pages".
- Fely Issue #1: Renamed `AppLayout.astro` → `app-layout.astro` to comply with `docs/architecture/components.md:14-22` kebab-case rule.

**Session log:** `.crew/sessions/session.1.4.md`
