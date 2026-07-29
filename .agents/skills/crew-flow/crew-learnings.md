# Crew Learnings (Skill Quarantine)

Skill-scope rules not yet stable enough to integrate inline. Graduate / decay / re-scope policy: `phase-5-fely-learning.md` Stage 4. Project-specific rules belong in the project's `.crew/crew-learnings.md`, not here.

---
trigger: "when a use case depends on today's date (weekday, calendar day, date range)"
scope: skill
confidence: 1
last-used: 2026-07-29
status: quarantine

---

When a use case depends on "today" (weekday math, calendar-day scoping, date-range queries), expose a `now?: Date` field on the input DTO. Tests inject a deterministic date (e.g. `new Date('2026-07-27T12:00:00Z')` for Monday); production callers leave it unset. Reason: deterministic unit tests for date-dependent logic without `vi.useFakeTimers` (which leaks time state across tests and makes test isolation fragile). Used in session 2.1 by `GetTodayWorkoutUseCase` — 17 unit tests across 5 weekdays, all green, no flakiness.

---

trigger: "branch/case sets 2+ related fields (a label + a derived lookup value) from hardcoded literals"
scope: skill
confidence: 1
last-used: 2026-07-24
status: quarantine

---

When a branch or case sets two or more related fields from hardcoded literals — e.g. a label plus a derived lookup value keyed by that same label — derive the second field from the first instead of duplicating a second literal per branch. Parallel literals drift out of sync via copy-paste, and the drift is silent (no type error, no test failure unless a fixture happens to exercise that exact branch). Reason: aim-tool bug 86bb2qfkp — a 4-branch calculation set both a schedule label and a matching hourly matrix per branch from two independent literals; one branch's matrix literal was copy-pasted from a different branch three lines below, while its label stayed correct. Fixed by deriving the matrix from the already-set label in one place, eliminating the duplication entirely.

---

trigger: "task notes combine with story X same file"
scope: skill
confidence: 1
last-used: 2026-06-02
status: quarantine

---

When a task says "combine with story X (same file, same pass)", verify the code before classifying it as MISSING in gap analysis — it may already be done in another session without the checkbox being updated. Reason: story 2.5 T6 was done in story 2.3 T8 but remained unchecked in story-2.5.md.

---

trigger: "story AC conflicts with constraint in a referenced ADR"
scope: skill
confidence: 1
last-used: 2026-06-25
status: quarantine

---

When a story's ACs conflict with a constraint stated in a referenced ADR, the story ACs win. ADRs are architecture intent; ACs are the sprint's delivery contract. Surface the conflict in Angel's gap table as DISCREPANCY, note which wins and why, and implement per the AC. Reason: ADR-0023 said `keyHelpText` must be non-null when `isKey=true`; story-5.8 AC-W1 explicitly allowed `null` as a valid placeholder. AC won — ADR was written before OQ-30 identified the copy-pending state.

---

trigger: "story's tasks reference an existing service with no explicit new behavior described"
scope: skill
confidence: 1
last-used: 2026-06-25
status: quarantine

---

When a story's tasks describe re-running or verifying an existing service (rather than building new behavior), confirm with the user what the story is trying to achieve before investigating API contract changes. A "verification story" (existing logic already correct, scope = tests) is distinct from a "behavior story" (new code required). The signal is the user's answer to "what does this task implement?" — if it's "confirm it works," shift to test-only scope immediately.

**Why:** Session 5.10 — Angel spent cycles investigating whether `upsert-package.service.ts` needed to return available measures. The story was entirely about proving existing behavior via tests. User clarified the intent; investigation time was wasted.

**How to apply:** In Angel Phase 1, if every task's "verify" statement describes observable behavior rather than new code, ask the user "is this a verification story (tests only) or does new code need to be written?" before building the full gap table.

---

trigger: "before removing a guard that git history or known-bugs.md attributes to a past bug"
scope: skill
confidence: 1
last-used: 2026-06-25
status: quarantine

---

Read the original rationale for the guard. If the current fix directly resolves that concern (changed message, changed data model, changed assumptions), the guard can safely go. If the original concern remains valid, keep the guard and fix the symptom differently.

**Why:** Session zone-matrix-alison-bugs — `vivariumArea > 0` guard (bug 86bagqvjz) existed to prevent a false-positive vivarium-specific banner. Changing the banner to generic resolved that concern — guard was safe to remove.

**How to apply:** `git log -S "guard-expression"` to find the commit that added it; read its message + linked ticket. Confirm the original concern is resolved before removing.

---

trigger: "writing service method that sets async status to 'loading' before an await"
scope: skill
confidence: 1
last-used: 2026-06-26
status: quarantine

---

Wrap the awaited call in try/catch and reset the status to `'error'` (then rethrow) on failure. Reason: bug 86baj55e9 — `lbt-buildings.service.ts::findOriginalParameters` set `updateStatus: 'loading'` but had no catch path; if the repository threw, the store was stuck in loading state forever.

**Why:** Alefrank alignment caught this as a missing edge case. It's easy to forget the error path when the happy path is the only one being considered.

**How to apply:** Pattern: `set({ status: 'loading' }); try { ... set({ status: 'success' }) } catch (err) { set({ status: 'error' }); throw err }`.

---

trigger: "adding a new named export to a module that is already vi.mock-ed in tests"
scope: skill
confidence: 1
last-used: 2026-06-29
status: quarantine

---

When adding a new named export to a module that is already mocked with `vi.mock()` in existing test files: grep test directories for the module path and add the new export to every mock factory — otherwise components receive `undefined` instead of the real value and tests crash with no clear assertion failure.

---

trigger: "before writing import statements in Astro/Vite projects"
scope: skill
confidence: 1
last-used: 2026-07-27
status: quarantine

---

Check tsconfig.json and vitest.config.ts for path aliases before writing imports. Astro/Vite projects use `@/` prefix for src directory, not `@lib/` or other custom prefixes. Reason: Project 1.3 had import failures due to incorrect path aliases.

---

trigger: "when adding new required fields to a database schema"
scope: skill
confidence: 1
last-used: 2026-07-27
status: quarantine

---

Update all test fixtures that create records in the modified table. Schema changes affect all tests that create records in modified tables. Reason: Project 1.3 had 7 test failures after adding email and password_hash fields to profiles table.

**Why:** Story 3.8 — added `DRIFT_MESSAGE` export to `use-zone-matrix-mismatch.ts`. The existing `package-list-drift-disabled.test.tsx` mocked the whole module but omitted `DRIFT_MESSAGE` in the factory. Component crashed at runtime in tests (undefined used as JSX string).

**How to apply:** After `export const FOO = ...` in a mocked module, run `grep -r "from '@/.../that-module'" tests/` and check each mock factory for the new export.

---

trigger: "writing a regression test for an animation/transition-timing bug (motion/framer AnimatePresence exit, CSS-transition-dependent state)"
scope: skill
confidence: 1
last-used: 2026-06-30
status: quarantine

---

Do not rely on jsdom/Vitest to reproduce it. jsdom has no real animation timing — motion exits resolve synchronously — so a "red" test passes on buggy code and proves nothing. Reproduce in a real browser (Playwright) or verify manually; keep any Vitest test only as a cheap invariant guard, and say so honestly.

**Why:** bug 86bap4ej8 — orphaned modal backdrop from `AnimatePresence mode="wait"`; the planned Vitest red test passed on the buggy code because jsdom completed the exit synchronously, burning a TDD cycle.

**How to apply:** When Angel/Alefrank scope a fix for a timing/animation bug, flag at plan time that the unit layer cannot go red; route the real regression coverage to Playwright or explicit manual verification.

---

trigger: "designing a frontend PATCH/PUT payload type for a multi-field backend resource"
scope: skill
confidence: 1
last-used: 2026-06-09
status: quarantine

---

Grep the backend DTO for class-level or cross-field validators before typing the frontend payload as `Partial<T>`. Per-field `@IsOptional()` does not rule out an all-or-nothing rule enforced at the class level.

**Why:** AIM project — a payload was typed as `Partial<Record<Category, {level}>>`, allowing single-category sends. The backend threw a 400 because a class-level validator required all categories present in every request.

**How to apply:** Before defining a frontend PATCH payload type, grep the backend DTO for `@ValidateIf` or custom class-level validators. If an all-or-nothing rule exists, use the full `Record<...>` type and add a helper that always builds the complete payload.

---

trigger: "adding a constructor dependency to a service that is backed by a shared/central test module"
scope: skill
confidence: 1
last-used: 2026-06-03
status: quarantine

---

Update that shared test module (providers + exports) in the same PR as the new dependency. A missing provider causes bulk dependency-injection failures at test compile time with no clear error pointing to the real cause.

**Why:** AIM project — `roi-tool-testing.module.ts` backs 220+ tests; adding a dependency to the service it wraps without updating the module's providers/exports array caused widespread DI failures.

**How to apply:** When adding a new dependency to a service, grep for the test module(s) that provide it and update providers + exports in the same change.

---

trigger: "declaring implementation done after changing a function/method signature, in a project whose test runner transforms TypeScript without type-checking it (Vitest + SWC/esbuild/babel)"
scope: skill
confidence: 1
last-used: 2026-07-07
status: quarantine

---

Run the project's real type-checker (`tsc --noEmit` / `tsc -b --force`) project-wide before declaring the change done — do not rely on the test suite alone.

**Why:** Bug 86bar376t — after adding a required param to several function signatures in both `aim-tool` and `lab-benchmarking`, `vitest run` stayed 100% green while 27+ backend tests and 16+ frontend tests (including a shared test utility backing 17+ other tests, and a production caller in `ReportsCreatorService`) silently kept calling the old signature. Extra/missing JS args just become `undefined` — the tests kept "passing" without exercising the new logic. `tsc` caught every instance instantly, independently, in both repos.

**How to apply:** After any signature change, run `tsc --noEmit -p tsconfig.json` (Node/backend) or `tsc -b --force` (frontend with project references) across the whole project — not just changed files — and treat every resulting error as a real regression.

---

trigger: "scoping the blast radius of a backend contract change (new required param on an endpoint family)"
scope: skill
confidence: 1
last-used: 2026-07-07
status: quarantine

---

Grep broadly for every client-side method AND every test file (unit, integration, api-spec) that calls the affected endpoint(s) — do not rely on the ticket's reproduction steps or the initial plan to define the full surface.

**Why:** Bug 86bar376t — the original plan covered 3 of 6 `HttpPackagesRepository` methods touching the changed endpoint family; the user caught the miss twice (once per repo, "did you also check X") before a full grep sweep found a shared test-utility class used by 17+ existing tests, 5 more raw test call sites, and a production caller that the original scoping missed entirely.

**How to apply:** When Angel scopes a fix that changes a backend contract, grep the whole frontend repo for every repository/service method hitting the affected route pattern, and grep the whole test tree (not just the obviously-related test files) for calls to those methods — before finalizing the blast radius map.

---

trigger: "an automated repro test passes but the user still reports the live app failing (fix-mode debugging)"
scope: skill
confidence: 1
last-used: 2026-07-08
status: quarantine

---

Do not conclude "cannot reproduce" from a passing automated test alone. Check whether the test fixture's default state (ownership flags, permission-like markers, ACL state) actually represents the real-world condition the user is hitting — if not, instrument the running app with temporary debug logs and have the user reproduce live before escalating or closing.

**Why:** Bug 86batzcdr (aim-tool) — a test replicating "add ECM076, check ECM095 availability" passed using a fixture whose `hvacType` field had `lastModifiedBy: 'lbt'`. Every real building has that field as `lastModifiedBy: 'user'` (filled in during setup) — the exact condition that silently blocked the fix via a user-protection guard. Static fixture testing alone missed the actual bug for several turns; live debugging with the user (temporary console.log instrumentation, removed after) found it in minutes.

**How to apply:** When a fix-mode repro test goes green but the user insists the bug still reproduces live, don't argue from the test — add temporary debug logs at the key decision points (state before/after the suspected mutation, inputs to the final validate/guard check) and walk the user through reproducing in their real environment.

---

trigger: "a spec narrative (FR/AC/story) describes a rule that was derived from a spreadsheet or external source-of-truth document"
scope: skill
confidence: 2
last-used: 2026-07-17
status: quarantine

---

Do not trust the narrative description alone — re-read the source document's literal column/header definition, and cross-check against at least one other already-confirmed case in the same doc set before accepting the interpretation during Gap Analysis.

**Why:** Bug 86batzcdr (aim-tool) — `FR-MEAS-P4-008`, story-5.5 AC-W2, and TC-0288 all described "ECM053 excludes ECM076 and ECM095" (ECM053's presence blocks others). The actual sheet's column header was "Mutually exclusive measures (measures that PREVENT THIS ONE from being available)" — the opposite direction (others' presence blocks ECM053). This was confirmed by cross-checking an unrelated, already-documented case in the same test plan (ECM084A/ECM108) that unambiguously used the column's literal direction. Angel's Phase 1 gap analysis trusted the FR/story/TC narrative without independently re-reading the sheet's header semantics, and missed a real spec self-contradiction until the user, working from the raw sheet, caught it after the fix had already shipped.

**How to apply:** When a requirement or AC restates a rule that ultimately comes from a spreadsheet, CSV, or other external artifact, read that artifact's actual column/field definitions directly (not just cited excerpts) and validate the interpretation against a second, unrelated example already confirmed elsewhere in the docs — before finalizing the gap table, not after implementation.

---

trigger: "Phase 2's implementation plan explicitly declares a Test Modification Protocol intention (test name, current assertion, planned change, reason) and the user approves the plan"
scope: skill
confidence: 1
last-used: 2026-07-08
status: quarantine

---

Treat the plan approval as satisfying the Step 2d gate for that specific test — Julian does not need to re-ask before editing it in Phase 3.

**Why:** Session 86batzc73 (AIM project) — the Phase 2 plan named `csp-row-render.test.tsx`'s `#17 custom` describe block, stated its current assertion, the planned change, and why, and the user approved the plan as a whole. Re-asking the same question in Phase 3 would be redundant.

**How to apply:** Only skip the Step 2d re-ask when the plan's declaration is specific enough to stand in for it (names the exact test, current behavior, planned change, and reason) — a vague "some tests may need updating" in the plan does NOT satisfy the gate; Julian still asks in that case.

---

trigger: "Phase 2 plan names the file path for a new test Julian will write"
scope: skill
confidence: 1
last-used: 2026-07-09
status: quarantine

---

Before finalizing the path, check the project's own CLAUDE.md (already loaded in Phase 0) for its documented test-file convention — co-located next to the source file vs. a centralized `tests/` directory. Don't default to co-location.

**Why:** Session 86baupdqa (AIM project) — the draft plan named `status-badge.test.tsx` co-located next to `status-badge.tsx`. The frontend's own `CLAUDE.md` Testing section (already read in Phase 0) documented `tests/unit/<domain>/*.test.tsx` as the actual convention. Julian caught it during Phase 3 by globbing for existing test files, but the plan should have gotten it right first.

**How to apply:** When Alefrank drafts the implementation plan's file list and it includes a new test file, re-check the already-loaded project CLAUDE.md for a stated test-file convention before writing the path into the plan.

---

trigger: "correcting a stale/false known-bugs.md claim about a shared component's or module's behavior"
scope: skill
confidence: 1
last-used: 2026-07-09
status: quarantine

---

Grep ALL `known-bugs.md` files project-wide for the same claim, not just the domain-obvious one — the same false claim can be duplicated across multiple context files that independently reference the same component.

**Why:** Session 86baupdqa (AIM project) — the false claim "StatusBadge no longer uses `useDismissBanner` — resolved in story 2.14" was found duplicated verbatim in two separate files: `buildings-parameters.md` (#32-34) and `reports.md` (#4/#6/#14). Checking only the first (found via the obvious domain match) would have left the second stale.

**How to apply:** When Fely's known-bugs cleanup pass (Phase 4, Step 10) finds a stale claim about a component, don't stop at the first match — grep the full `docs/quality/known-bugs/` tree (or project equivalent) for the same component name/claim text before finalizing corrections.

---

trigger: "mocking node:fs (or other Node builtin) exports in a Vitest ESM test"
scope: skill
confidence: 1
last-used: 2026-07-09
status: quarantine

---

`vi.spyOn(fs, 'writeFileSync')` on an `import * as fs from 'node:fs'` throws `TypeError: Cannot spy on export "writeFileSync". Module namespace is not configurable in ESM.` Use `vi.mock('node:fs', () => ({ writeFileSync: vi.fn(), mkdirSync: vi.fn(), ... }))` instead, then `vi.mocked(fs.writeFileSync)` to assert/clear.

**Why:** Session 86bapz19f (aim-tool) — `dump-roi-payload.util.spec.ts` first tried `vi.spyOn` on `node:fs` exports; ESM makes builtin module namespaces non-configurable, so spyOn fails immediately regardless of test logic.

**How to apply:** Whenever a test needs to intercept a Node builtin (`node:fs`, `node:path`, etc.) called from the unit under test, reach for `vi.mock('node:builtin', () => ({...}))` first — never `vi.spyOn` on the imported namespace object.

---

trigger: "a value crossing a system boundary as an enum/select fails validation on the receiving side, and the field is one of several similarly-shaped fields fed by the same external source"
scope: skill
confidence: 1
last-used: 2026-07-23
status: quarantine

---

Don't investigate the failing field in isolation. First find every sibling field of the identical shape (same UI control type, same external data source) and check whether a normalization/mapping layer already exists for them but is missing for the one that's failing — a fix for this exact defect shape was often already applied to a sibling and simply missed for the current field. Then, for every sibling that looks "safe" because it uses the same raw-passthrough as the broken field, verify it explicitly by diffing the actual enum/value sets on both sides of the boundary — do not assume a sibling is safe just because it shares the same code shape; it may be safe by coincidence (its target enum already happens to accept the raw external representation) rather than by an actual fix, and that distinction matters when writing the fix and its tests. Finally, trace exactly where in the receiving pipeline the rejection happens (e.g. a class-validator DTO gate vs. a downstream normalization service) — a fix aimed at code the failing request never reaches (because validation rejects it first) fixes nothing.

**Why:** Bug 86bb24rdw (AIM project) — LBT's `hvac_type` field was passed raw from its internal data store ("BPD") straight to AIM's `hvacType`, which only validates the plain label `'Other'`, while BPD's raw value for that option is `'Other Or Combination'`. Every sibling enum field fed by the same source (`heating`, `cooling`, `labType`, `exhaustAirEnergyRecovery`, and critically `hvacControl` — which has the *identical* "Other Or Combination" alternate-label shape in the shared field-metadata file) already normalizes this via a shared `findEnumValue()` helper; `hvacType` was the one field missed when that normalization pattern was applied. Two other raw-passthrough fields (`labUse`, `occEngagement`) looked like the same bug at first glance but turned out coincidentally safe on inspection — one target enum defines both label variants as separate valid members, the other target enum is defined in terms of the external source's raw labels already. Diffing each candidate's actual enum values (not just checking "does it call the normalization helper or not") was what separated the one real bug from the two false positives. Also confirmed the downstream processor that handles this field's edge cases (`UnknownValuesProcessor`) never runs for the invalid value at all — the DTO's `@IsEnum` check rejects it earlier in the pipeline — so the fix had to target the LBT-side transform, not that backend processor.

**How to apply:** In Angel's fix-mode Blast Radius Analysis (Step 2/Step 3), when the bug is "an enum-like value from an external source fails validation," (1) find the field's metadata/config source (e.g. a shared fields dictionary) and check for an "alternate label"/raw-representation concept, (2) list every sibling field sharing that metadata shape and check which ones already have a normalization call and which don't, (3) for siblings that lack normalization but appear safe, confirm by diffing the actual accepted-value sets on both sides rather than pattern-matching on code shape alone, and (4) trace the receiving pipeline to confirm which gate actually rejects the value, so the fix (and its test) target the real chokepoint.

---

trigger: "writing a regression test for a bug whose root cause is the interaction between two collaborating services (one rebuilds/resets shared state, another reads or preserves a piece of it)"
scope: skill
confidence: 1
last-used: 2026-07-23
status: quarantine

---

Before trusting a red (or green) test for a cross-service interaction bug, check whether the existing test file already mocks the OTHER collaborating service as a no-op or as a mock that ignores its input/state. If it does, that mock must be replaced with the real implementation (stubbing only ITS OWN external dependencies, e.g. an HTTP client) — a no-op mock can never see the shared state get corrupted, so a test written against it proves nothing about the actual bug.

**Why:** Bug 86bb1xb77 (aim-tool) — `ZonesService.recalculate()` regenerated `building.aim` from `DEFAULT_ASSUMPTIONS` (peakCFM placeholder = 0) before `CalculatePeakCfmService.run()` ran; that service's USER-preserve branch then trusted the already-corrupted value and re-saved it as `0`. `zones.service.spec.ts` had mocked `CalculatePeakCfmService.run` as `{ run: async () => {} }` since the service was introduced — a mock that never reads `building.aim.basic.peakFlow` at all. Every test in that file could stay green forever regardless of this bug; the seam between the two services was structurally untestable until the mock was replaced.

**How to apply:** When a fix-mode root cause spans two services/files (A resets or rebuilds shared state, B reads/preserves part of it), check A's existing spec file for how B is mocked. If B is a no-op or ignores its arguments, flag in Phase 2's plan that Julian must wire in B's real implementation for the new regression test (mocking only B's own external calls, e.g. the ROI HTTP client) — a bare "was called" assertion on the no-op mock is not sufficient coverage, and Fely should reject it at QA if seen.

---

trigger: "a bug report describes literal 'null'/'undefined'/'NaN' text appearing in the UI"
scope: skill
confidence: 1
last-used: 2026-07-24
status: quarantine

---

Before letting a possibly-null/undefined value reach a user-facing string via template-literal interpolation or `String()`, check whether it can legitimately be absent — if so, map it to an explicit sentinel (`'Unknown'`, `'N/A'`, etc.) before interpolation. JS coerces `null`/`undefined` to the literal text `"null"`/`"undefined"` silently — no error, no warning.

**Why:** Bug 86bade5n1 (lab-benchmarking) — `getLBTOriginalValue()` did `String(lbtValue ?? null)`, which silently produced the literal string `"null"` shown to the user as `"Original: null"`. This was "pre-existing AIM 3 behavior" precisely because nothing about it throws or fails a naive test — it just prints wrong text.

**How to apply:** In Angel's fix-mode analysis or Julian's Step 2b antipattern scan, when a bug report describes literal "null"/"undefined"/"NaN" text appearing in the UI, immediately suspect an un-guarded template literal or `String()` call on a nullable value — grep the render site for `${` interpolations of the suspect field before looking anywhere else.

---

trigger: "a fix corrects what a shared function returns for an edge case"
scope: skill
confidence: 1
last-used: 2026-07-24
status: quarantine

---

When a fix corrects what a shared function returns for an edge case, grep for OTHER call sites of that same function that already check for the corrected value — a sibling component may have been written expecting the fix's target value and been silently dead code until now.

**Why:** Bug 86bade5n1 (lab-benchmarking) — `restore-param-modal.tsx` already contained `getLBTOriginalValue(parameter) === 'Unknown'`, written in anticipation of exactly this contract, but it was unreachable because the function actually returned `'null'`. The fix didn't just correct a bug — it activated a previously-dead branch elsewhere that needed its own test coverage, which would have been missed without explicitly grepping all call sites first.

**How to apply:** In Alefrank's Phase 1.5 alignment or Phase 2 plan, when Angel's blast radius lists a shared utility function, grep every call site for comparisons against the value the fix will now start returning — any match is either (a) previously-dead code the fix will activate (needs new test coverage), or (b) evidence the intended contract already existed elsewhere and the bug was pure implementation drift, not spec ambiguity.

---
trigger: "appending markdown content with unicode characters via PowerShell on Windows"
scope: skill
confidence: 1
last-used: 2026-07-28
status: quarantine

---

**Never use inline PowerShell here-strings (`@"..."@`) to append markdown content containing em-dash (—), check marks (✅), warning signs (⚠️), or other non-ASCII characters.** PowerShell here-strings on Windows can corrupt UTF-8 multibyte sequences, producing mojibake like `â€"` or `âœ…` in the written file. Use one of:
1. `insert_edit_into_file` / `replace_string_in_file` tools (preserves UTF-8).
2. A temp `.ps1` file written with `[System.IO.File]::WriteAllText` using `[System.Text.UTF8Encoding]::new($false)`.
3. `Get-Content -Encoding UTF8` to read, modify, `Set-Content -Encoding UTF8` to write.

Reason: session 1.4 had multiple PowerShell appends corrupt the session log with `â€"`, `âš ï¸`, `âœ…`, and dropped leading `a`/`n` characters (`stro check` instead of `astro check`, `pm run` instead of `npm run`, `ria-label` instead of `aria-label`).

---
trigger: "running typecheck for UI stories (Astro / Svelte / React / Next)"
scope: skill
confidence: 1
last-used: 2026-07-28
status: quarantine

---

For UI stories, run BOTH the typecheck (`astro check` / `tsc --noEmit` / equivalent) AND the production build (`astro build` / `next build` / equivalent). Typecheck alone is not sufficient — `Astro.url` access in SSR, asset bundling, frontmatter execution, and adapter-specific output are caught by build only, not by `astro check`. A green typecheck can still produce a build that throws at runtime on the first request. Reason: session 1.4 verified both — `astro check` and `astro build` — for the AppLayout + Navigation components; both passed cleanly.
