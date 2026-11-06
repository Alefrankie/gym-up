# Session: routine-multiple-weekdays

## Resumption — 2026-11-06

The carried-over conversation authorized implementation and creation of a proposed DR.
Agreed behavior: one routine can have several weekdays; overlaps are selectable on Home;
completed routines stay marked while remaining routines stay available; unscheduled programs rotate.
No prior crew session log was present on resumption. Earlier phase completion cannot be verified.

## Implementation checkpoint

- Existing partial changes included contracts, SQLite migration/repositories, routine editor and Home.
- Preserved the existing single-result helper contract and added `matches` for all scheduled choices.
- Added four scheduling tests; observed three fail before the helper correction, then all pass.
- Added a SQLite migration test for backfill, Sunday, uniqueness, bounds and cascade cleanup.
- Corrected mixed-program weekly targets to count unscheduled routines at least once.
- Corrected legacy weekday serialization when clearing all assignments.
- Home's multi-choice next-routine text no longer claims all training is complete prematurely.

## Verification

- `pnpm test`: PASS, API 365 + app 127 + contracts 4 = 496 tests.
- `pnpm typecheck`: API/contracts pass; app fails on two CoachEvent incompatibilities in
  `apps/app/src/routes/voice-studio/+page.svelte:312,326`, not modified by this change.
- Browser/device QA: not run. Multi-choice completion/resume UI and offline cold start remain manual gaps.
- DR-0031 remains proposed. No deployment or migration against real data performed.
- Full crew QA/learning workflow has not been completed; do not infer approval from these checks.
