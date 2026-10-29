---
story_id: "12.5"
round: "round-12"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/workout-tracking/readme.md"
size: "S"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["workout-tracking", "exercise-library", "routines", "progression", "progress", "body-metrics", "private-photos", "social", "public-view", "nutrition"]
  prd_requirements: []
  architecture_decisions: []
  flows: []
blocked_by: ["story-7.1", "story-7.2", "story-7.3", "story-7.4", "story-8.1", "story-8.2", "story-8.3", "story-8.4", "story-9.1", "story-9.2", "story-9.3", "story-9.4", "story-9.5", "story-10.1", "story-10.2", "story-10.3", "story-10.4", "story-11.1", "story-11.2", "story-11.3", "story-11.4", "story-12.1", "story-12.2", "story-12.3", "story-12.4"]
blocks: []
---

# Story 12.5 — Phase 2 parity acceptance (E2E)

Parent: [../readme.md](../readme.md)

## Summary

The Phase 2 gate: one Playwright scenario for every row of the [exit criteria](../readme.md#exit-criteria--hevy--gravl-parity) (H1–H24, G1–G8, U1–U3), run on `STORAGE_BACKEND=sqlite` and on `supabase`, plus a generated parity report and the Phase 2 definition of done (docs status sweep). The scenarios are acceptance smoke tests: each proves the observable capability of its row once; edge cases stay in the tests of the story that built it. Closes round criterion AC-R12-06 and every Hevy, Gravl and unique row.

## Files in scope

**Modify**

- `playwright.config.ts` (created in story 12.3) — one project per backend (`STORAGE_BACKEND` from env), JSON reporter to `playwright-report/parity-<backend>.json`.
- `package.json` — scripts `test:e2e:parity` (`playwright test tests/e2e/parity`) and `parity:report` (`node scripts/parity-report.mjs`).
- `tests/e2e/helpers/{auth,app}.ts` (created in story 12.3) — reused; new helpers are added beside them.
- `docs/stories/phase-2/readme.md` (add "Status: completed" and the link to the parity report), the six `docs/stories/phase-2/round-N/readme.md` story tables (status `completed`).
- `docs/trace/readme.md`, `docs/prd/features/requirements-index.md`, `docs/prd/overview.md`, `docs/README.md` — Phase 2 status (task `T12.5-09`).
- Every Phase 2 context readme and flow (`workout-tracking`, `exercise-library`, `routines`, `progression`, `progress`, `body-metrics`, `private-photos`, `social`, `public-view`, `user`): `Status` field and Use Cases rows from `planned` to `implemented`, only where an earlier story left them behind.

**Create**

- `tests/e2e/parity/parity-ids.ts` — the 35 row ids and `parityTitle(id, text)`.
- `tests/e2e/parity/hevy-logging.parity.spec.ts` (H1–H10, H22), `hevy-library-routines.parity.spec.ts` (H11–H15), `hevy-stats-social-platform.parity.spec.ts` (H16–H21, H23, H24), `gravl.parity.spec.ts` (G1–G8), `unique.parity.spec.ts` (U1–U3).
- `tests/e2e/parity/parity-coverage.test.ts` — vitest: every row id of the exit-criteria table has exactly one scenario.
- `tests/e2e/helpers/{family,seed}.ts` — `createFamily()` (two registered users with an active program) and `seedCompletedWorkouts(request, user, workouts[])`, which calls the real idempotent write endpoints with client UUIDs and chosen `startedAt` values.
- `scripts/parity-report.mjs`, `scripts/check-phase-2-docs.mjs`.
- `docs/stories/phase-2/parity-report.template.md`; `docs/stories/phase-2/parity-report.md` (filled on completion).
- `tests/scripts/parity-report.test.ts` — vitest: sample Playwright JSON → expected markdown.

**Not in scope (must not change)**: `src/**`, `db/**`, `supabase/**`. A failing scenario is fixed in the story that owns the row (reopen it), not by weakening the test here.

## Happy Path

1. A maintainer starts the suite: `STORAGE_BACKEND=sqlite npm run test:e2e:parity`. Playwright builds with `E2E=1`, starts the node server and runs the 35 scenarios against a fresh SQLite database.
2. The same command runs with `STORAGE_BACKEND=supabase` and the Supabase environment variables.
3. `npm run parity:report` reads both JSON results and writes `docs/stories/phase-2/parity-report.md`: one row per exit-criteria id with a result per backend.
4. All rows are green on both backends; the maintainer marks the stories `completed`, runs `node scripts/check-phase-2-docs.mjs` and updates the phase status docs (definition of done below).

## Decisions

| # | Decision |
|---|---|
| D1 | Scenarios are grouped in five spec files; every `test()` title starts with its row id (`H16 …`) so `--grep "H16 "` runs one row and the report maps results by title. |
| D2 | Data for history-dependent rows (G3, G4, H5, H16) is seeded through the real write endpoints (`PUT /api/workouts/[id]`, `PUT /api/workout-exercises/[id]`, `PUT /api/workout-sets/[id]`, `POST /api/workouts/[id]/finish`) with client UUIDs and past `startedAt`, so the same helper works on both backends and no test touches a database directly. |
| D3 | Time-dependent rows (H9 elapsed time, G2 weekend rotation, G8 week boundaries) use Playwright's `page.clock`. |
| D4 | `createFamily()` registers fresh users through `/register`. If Supabase rate limits or provisioning make that impossible, it falls back to accounts from `E2E_USER_A_EMAIL/PASSWORD` and `E2E_USER_B_EMAIL/PASSWORD` (the fixed-account pattern of `tests/supabase/integration-helpers.ts`). Verify which path works on each backend in task `T12.5-01`. |
| D5 | U2 is "regression only" (phase table): it asserts that the nutrition page loads, a manual meal updates the daily calorie bar, and — when `GEMINI_API_KEY` is set — that a photo analysis returns a result. Without a key the photo step is skipped with a reason, the report shows "photo analysis: manual", and the maintainer checks it once per release. |
| D6 | The report treats a row as passed only when its test passed on **both** backends without a retry; a retried pass is marked "flaky" and blocks completion until investigated. |
| D7 | Phase 2 is complete when the definition of done below holds; there is no partial-completion state for the phase. |

## Scenarios (one per exit-criteria row)

| Row | Scenario (observable proof) | Story |
|---|---|---|
| H1 | *Entrenamiento libre* opens an empty live workout; discard it; start the next routine with *Empezar*; finish a one-set workout; on its detail *Repetir* opens a live workout with the same exercises and empty values | 9.1 |
| H2 | In a live workout add an exercise from the picker, move it (*Bajar*), replace it, remove it; the list order and `position` follow each step | 9.1 |
| H3 | Link two exercises as a superset: "Superserie" bar, contiguous; checking a set on the first starts no timer, on the last it does | 9.1, 9.2 |
| H4 | Set a row to warm-up, drop and failure: labels `W`, `D`, `F`, and normal ordinals skip them | 9.2 |
| H5 | After a seeded earlier session of the same exercise, *Anterior* shows its values and tapping it copies them into the row | 9.2 |
| H6 | Enable *Registrar RPE* in settings, log a set with RPE 8.5; the value shows in the workout detail | 9.2 |
| H7 | Checking a set shows the rest timer with the exercise's rest seconds, ±15 s adjusts it, and a `Notification` is raised when it ends (permission granted by the browser context) | 9.2 |
| H8 | Log one set each of a bodyweight, an assisted, a timed and a distance exercise; each renders only its own metric fields and the workout finishes | 7.1, 9.2 |
| H9 | The live header shows elapsed time (advanced with `page.clock`), volume and sets, and they update when a set is checked | 9.1 |
| H10 | Finish shows the summary v2 (duration, volume, sets, PRs); edit a past workout (change reps) and save; delete another past workout after the confirmation and it leaves *Historial* | 9.3 |
| H11 | `/exercises` lists ≥ 100 system exercises; searching "bench" and filtering by muscle narrow the list; a detail page shows instructions | 7.2, 7.3 |
| H12 | Create a custom exercise (name, type, muscle); it appears in the library and in the picker | 7.4 |
| H13 | Create a program, add a routine with exercises (rep range, rest, superset, notes), set it active; the dashboard offers it as next | 8.2 |
| H14 | Adopt a template; copy a sibling's routine from their program; both appear under my programs | 8.1, 8.2 |
| H15 | After finishing a workout, *Guardar como rutina* creates a routine with the same exercises | 9.3 |
| H16 | Beat a previous weight: a 🏆 badge appears live on the set, the summary lists the PR, and the exercise *Récords* tab shows the rep-max table | 10.1 |
| H17 | `/exercises/[id]` has working *Historial*, *Gráficas* (chart canvas rendered, range switch) and *Récords* tabs | 11.2 |
| H18 | `/progress` shows the weekly bars, muscle distribution, a month calendar with a workout dot and the weekly streak | 11.2 |
| H19 | Log weight and waist; they appear in the measurements list and chart, and the latest values on `/profile` | 11.1 |
| H20 | User A finishes a workout; B sees it in the feed, likes and comments; A sees the dot and both items in `/activity` (AC-R12-01) | 12.1 |
| H21 | *Compartir* on the summary triggers a download named `gymup-yyyy-mm-dd.png`; the PNG header reads 1080 × 1350 (AC-R12-02) | 12.2 |
| H22 | Plate calculator for 100 kg with a 20 kg bar shows 40 kg per side as plates; the warm-up generator inserts warm-up sets; the 1RM calculator returns the Epley e1RM of 100 × 5 (116.67 before the display rounding fixed by story 9.5) and its 50–95 % table | 9.5 |
| H23 | The manifest is installable (name, icons, `standalone`), the SW controls the page; offline: start, log 3 sets, finish, reconnect; the server holds each set once (AC-R12-03) | 12.3 |
| H24 | *Exportar entrenamientos (CSV)* downloads `gymup-workouts.csv`; the header matches the Hevy columns and the row count equals the completed sets (AC-R12-05) | 12.4 |
| G1 | The onboarding questionnaire recommends a program; *Adoptar* makes it the active program | 8.4 |
| G2 | After finishing routine A the dashboard shows routine B as next, also with the clock set to a weekend | 8.3 |
| G3 | The second session of an exercise prefills a suggestion chip with its explanation | 10.2 |
| G4 | Seeded stalled history shows the plateau notice with its options | 10.3 |
| G5 | Accepting *Semana de descarga* makes the next workout a deload with reduced prefill and its label | 10.3 |
| G6 | A low readiness check-in adjusts the session ("Sesión ajustada: −1 serie") | 10.4 |
| G7 | After a seeded chest workout, the recovery map marks chest as fatigued | 10.4 |
| G8 | `/progress` shows the weekly coach card; without `GEMINI_API_KEY` it shows template text and no error; *Generar resumen* stops after 3 uses with "Disponible el lunes" | 11.4 |
| U1 | Upload two photos, compare them; another user gets 403/404 on the file URL and the photos appear on no family page | 11.3, Phase 1 4.2 |
| U2 | Nutrition regression per D5 | Phase 1 Round 5 |
| U3 | As B, crawl `/family`, `/family/[A]`, `/workouts/[A workout]`, the feed and `/activity`: none of A's markers (measurement values, photo file name, readiness score, meal name, e-mail) appears in any response body, and A's private URLs answer 403/404 | 12.1, 12.5 |

## Acceptance Criteria

- AC-12.5-01: `tests/e2e/parity/parity-coverage.test.ts` parses the exit-criteria tables of `docs/stories/phase-2/readme.md` and proves each of the 35 ids (H1–H24, G1–G8, U1–U3) has exactly one scenario whose title starts with that id, and no scenario exists for an id outside the table.
- AC-12.5-02: with `STORAGE_BACKEND=sqlite`, all 35 scenarios pass, with no retry and no skip other than the U2 photo step without a key (D5).
- AC-12.5-03: with `STORAGE_BACKEND=supabase`, all 35 scenarios pass under the same conditions, and every row has the same result on both backends.
- AC-12.5-04: scenarios are independent: each creates its own users and data, runs alone with `--grep "<id> "` and in any order, and leaves no state the next one needs.
- AC-12.5-05: `npm run parity:report` writes `docs/stories/phase-2/parity-report.md` from the two JSON files: a row per id with story, result per backend (✅ pass, ❌ fail or missing, ⚠ flaky or skipped with reason), the commit sha and the run date; a row missing from either JSON is ❌. `tests/scripts/parity-report.test.ts` proves the mapping from a sample JSON.
- AC-12.5-06 (U3): the privacy sweep finds none of user A's private markers in any response body B can reach and gets 403/404 on A's private URLs, on both backends.
- AC-12.5-07 (Phase 1 regression): the Phase 1 fixture regression tests (`tests/workout-tracking/phase-1-fixture.regression.test.ts` and the ones added by the migration stories in `tests/progress/`, `tests/social/`) pass in the same run as the suite.
- AC-12.5-08 (definition of done, docs): `node scripts/check-phase-2-docs.mjs` exits 0: no Phase 2 context readme or flow has `Status | planned`, no Use Cases row is `planned`, the six round readmes list every story as `completed`, and every story file has status `completed` with Implementation Evidence filled.
- AC-12.5-09: the parity report and `docs/trace/readme.md`, `docs/prd/features/requirements-index.md`, `docs/prd/overview.md` and `docs/README.md` state Phase 2 as implemented with the parity-report link.

## Phase 2 definition of done

Phase 2 is **done** when all of the following hold:

1. The 26 stories (7.1–12.5) are `completed` with Implementation Evidence.
2. The parity suite is green on both backends and `parity-report.md` is committed (AC-12.5-02, -03, -05).
3. `npm run typecheck` and `npm run test:run` pass; the RLS integration tests in `tests/supabase/` pass with `RUN_SUPABASE_INTEGRATION=true` against the Supabase project.
4. Supabase migrations 004–011 are applied to the production project and the seeds (exercises, templates) are loaded.
5. The docs sweep passes (AC-12.5-08, -09).

## Parity report template

`docs/stories/phase-2/parity-report.template.md` (the generator fills it; all 35 ids appear):

```markdown
# Phase 2 Parity Report

Commit: `<sha>` · Run: `<yyyy-mm-dd>` · Suite: `npm run test:e2e:parity`

| # | Capability | Story | sqlite | supabase | Notes |
|---|---|---|---|---|---|
| H1 | Start an empty workout or any routine; repeat a past workout | 9.1 | ✅ | ✅ | |
| ... | | | | | |
| U3 | Family visibility with private data never leaking | 12.1, 12.5 | ✅ | ✅ | |

Manual checks this release: photo analysis (U2) · installability on Android Chrome and iOS Safari (H23) · share sheet on mobile (H21)
Result: PASS only if every row is ✅ on both backends.
```

## Tasks

- [ ] `T12.5-01` - Environment check: confirm the Playwright setup of story 12.3 runs on both backends; decide the user provisioning path per backend (D4); document required env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `GEMINI_API_KEY`, `E2E_USER_*`).
- [ ] `T12.5-02` - `parity-ids.ts`, `parity-coverage.test.ts` and the `playwright.config.ts` projects / JSON reporter paths.
- [ ] `T12.5-03` - Helpers: `createFamily()` and `seedCompletedWorkouts()` (D2), clock helper (D3).
- [ ] `T12.5-04` - `hevy-logging.parity.spec.ts`: H1–H10, H22.
- [ ] `T12.5-05` - `hevy-library-routines.parity.spec.ts`: H11–H15.
- [ ] `T12.5-06` - `hevy-stats-social-platform.parity.spec.ts`: H16–H21, H23, H24.
- [ ] `T12.5-07` - `gravl.parity.spec.ts` (G1–G8) and `unique.parity.spec.ts` (U1–U3, D5).
- [ ] `T12.5-08` - `scripts/parity-report.mjs` + `parity-report.test.ts` + the report template.
- [ ] `T12.5-09` - Run both backends, generate `parity-report.md`, fix or reopen failing rows in their owning stories, then update `docs/trace/readme.md` (Phase 2 implementation → complete, decisions-log row), `requirements-index.md` (Phase 2 entries `implemented`), `docs/prd/overview.md` and `docs/README.md` (status line), the Phase 2 readmes and round tables.
- [ ] `T12.5-10` - `scripts/check-phase-2-docs.mjs`; run it; update docs: mark remaining context Use Cases rows `implemented`, fix any doc/code drift found, add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/e2e/parity/parity-coverage.test.ts` | unit (vitest) | One scenario per exit-criteria id, none extra (01) |
| `tests/e2e/parity/hevy-logging.parity.spec.ts` | e2e | H1–H10, H22 on both backends (02, 03, 04) |
| `tests/e2e/parity/hevy-library-routines.parity.spec.ts` | e2e | H11–H15 (02, 03, 04) |
| `tests/e2e/parity/hevy-stats-social-platform.parity.spec.ts` | e2e | H16–H21, H23, H24 (02, 03, 04) |
| `tests/e2e/parity/gravl.parity.spec.ts` | e2e | G1–G8 (02, 03, 04) |
| `tests/e2e/parity/unique.parity.spec.ts` | e2e | U1–U3 including the privacy sweep (02, 03, 06) |
| `tests/scripts/parity-report.test.ts` | unit (vitest) | JSON → markdown mapping, missing row = ❌, flaky = ⚠ (05) |
| `scripts/check-phase-2-docs.mjs` | script | Status sweep (08, 09) |
| Phase 1 fixture regression tests (existing) | integration | Phase 1 numbers unchanged (07) |

## Out of Scope

- New product behaviour or fixes: they belong to the story that owns the failing row.
- Load or performance testing beyond NFRs already tested in their stories (NFR-PR-P2-01 in story 10.1, NFR-WT-P2-02 in story 12.3).
- Cross-browser matrix (Chromium only; Android Chrome and iOS Safari installability stay manual checks in the report).
- Visual regression screenshots and accessibility audits.
- Production deployment steps beyond item 4 of the definition of done.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
