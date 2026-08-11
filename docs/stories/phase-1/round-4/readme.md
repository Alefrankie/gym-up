# Round 4 — Family & Privacy Surfaces

Parent: [../readme.md](../readme.md)

## Goal

Ship three user-facing surfaces: a public **Family** view (all members + per-member detail), a private **Photos** gallery (upload/view/delete owned by the current user), and a **Settings** page (profile editing + logout). Keeps the local-first rule (no Supabase until Round 6).

## Status matrix

| Story | Title | Status | Started | Completed | Commit |
|-------|-------|--------|---------|-----------|--------|
| [4.1](story-4.1.md) | Family View | ✅ completed | 2026-08-08 | 2026-08-08 | `8347763` |
| [4.2](story-4.2.md) | Private Photos | ✅ completed | 2026-08-10 | 2026-08-11 | `c8a75eb` + delete-UI fix pending |
| [4.3](story-4.3.md) | Settings Page | ✅ completed | 2026-08-11 | 2026-08-11 | pending commit |

## Dependency chain

```
story-3.3 (Round 3)
    └── story-4.1 ✅
            └── story-4.2 ✅
                    └── story-4.3 ✅
```

All three dependencies were respected operationally. Each story began only after the previous one was committed.

## Verification

| Check | Result |
|-------|--------|
| Vitest full suite (29 files, 214 tests) | ✅ 214/214 PASS |
| `tsc --noEmit` | ✅ exit 0 |
| Story 4.2 delete-UI bug (Round 4 audit, 2026-08-11) | ✅ fixed — `showModal` now receives + assigns `photoId` |
| Editor diagnostics (`src` + `tests`) | ✅ no errors |

## Known follow-ups (out of scope, deferred tickets)

| # | Item | Source |
|---|------|--------|
| 1 | Browser/E2E coverage for `/photos` upload → gallery → delete end-to-end | Session 4.2 GAP |
| 2 | Endpoint integration tests (`/api/photos*`, `/photos/file/[id]`) | Session 4.2 GAP |
| 3 | Orphan photo cleanup when a profile is deleted (cascade removes DB rows but not files) | Session 4.2 known gap |
| 4 | Roll back uploaded file if DB insert fails (current code writes file first) | Session 4.2 known gap |
| 5 | Drizzle migration journal reconciliation (`0002_*` and `0003_*` not in `_journal.json`) | Session 4.2 known gap |
| 6 | `workoutId` linking on photos (FR-PP-003 deferred) | Story 4.2 alignment |
| 7 | Byte-serving endpoint should import `photoRepository` through `private-photos` composition root (ADR-010 debt) | Session 4.2 minor |
| 8 | Browser smoke test for `/settings` save → reload → persists | Session 4.3 GAP |

## Architecture / pattern compliance

- ✅ Composition per context (ADR-010): each context has its own composition root; cross-context only via re-exports (`private-photos` re-exports `photoRepository`).
- ✅ Repository pattern (ADR-007 + ADR-011): abstract class `implements`.
- ✅ Local-first (no Supabase imports in any story's surface).
- ✅ PRG pattern on `/settings` (POST → 302 → GET with query param).
- ✅ Ownership enforced in repository layer (ADR-004 / ADR-005).
- ✅ Kebab-case filenames.

## Round retrospective

- **What worked:** Pattern reuse (existing `ProfileRepository.update` for settings; existing `/logout` route for the button), TDD red→green discipline, Julian's self-QA checklist, Alefrank's alignment catches caught the routine-type-warning misinterpretation early.
- **What hurt:** Story 4.2 session log declared "delete UI verified" but the modal never assigned `photoId` to the hidden input — caught only by the Round 4 audit, not by tests. Lesson: **UI flows need browser/E2E coverage**, not just use-case tests.
- **What to improve next round:** Add Playwright (or similar) smoke tests for any story that has nontrivial client-side JavaScript (modal logic, form PRG, in-page interactions).
