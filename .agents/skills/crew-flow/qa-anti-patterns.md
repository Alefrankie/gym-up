# QA Anti-Patterns — Failure Modes That Escape to QA

Derived from Sprint 2–6 failure analysis (33.8% rework rate across 65 tasks). These are the patterns that passed unit tests but failed QA/UAT. Every pattern here shipped at least once.

**Purpose:** loaded in Phase 0, consulted in Phase 3 (self-QA) and Phase 4 (Fely review). Julian must challenge his own implementation against these BEFORE handing off.

---

## How to use this file

**Phase 3 (Julian self-QA):** After tests go green, walk through each category below. For every pattern that touches the code you changed, run the specific check described. If a check fails → fix before handoff. If a check cannot be run (e.g., requires browser) → document it as a known gap for Fely.

**Phase 4 (Fely QA):** Use these patterns to focus review attention. Historical data shows these are where bugs hide — spend disproportionate time here.

**Phase 2 (Alefrank plan):** Reference relevant categories when building the implementation plan. If the story touches a high-risk category, include specific verification steps in the plan.

---

## Category 1: Silent Value Reversion

**Historical impact:** CRITICAL — most expensive failures (5d+ QA time per task)

**What happens:** A value the user explicitly set reverts to a default/assumption value silently — no error, no toast, no visual indication. The user only discovers it on the next page load or after navigating away and back.

**Root causes:**
- Backend recalculates assumptions without respecting user-owned fields
- Frontend loses state on tab navigation or route change
- `USER_PROTECTED_KEYS` list is incomplete — a field that should be protected is overwritten by the recalculation pipeline
- A measure's `apply()` method writes to a field the user owns without checking ownership

**Checks:**
1. **Set → Navigate → Return:** For every user-editable field the code touches: set a non-default value → navigate to another page → return → verify the value persists
2. **Set → Change Neighbor → Verify:** Set value A → change an unrelated parameter B → verify A persists
3. **Protected key audit:** If the code modifies `GenerateAimParametersService` or any recalculation path, grep `USER_PROTECTED_KEYS` and verify every field the code writes to is either (a) not in the protected list, or (b) correctly respects the `forceProtectedWrite` conditional pattern
4. **Measure ownership check:** If a measure's `apply()` writes to a field, verify it uses the `forceProtectedWrite` flag ONLY when `isTagging || scope === VIRTUAL` — never unconditionally

**Anti-pattern signal:** Any code path that writes to a building parameter without checking `lastModifiedBy`

---

## Category 2: Calculation / Measure Logic Bugs

**Historical impact:** HIGH — broke downstream package calculations

**What happens:** Incorrect calculations or broken measure detection/dependency logic. Manifests as wrong savings, wrong costs, or measures not appearing/disappearing when they should.

**Root causes:**
- Measure dependency chains not fully mapped (ECM A enables B, which modifies C that D reads)
- `isAlreadyImplemented()` self-referential checks — the strategy's own `apply()` writes the field it checks
- `isTaggingPreconditionMet()` missing on new measures
- Combinatorial interactions between 2+ measures in a package not tested

**Checks:**
1. **Dependency chain trace:** For every ECM the code touches, list its `dependencies` array AND every other ECM whose `dependencies` reference it. Test at least one interaction between the ECM and each of its reverse-dependencies
2. **Self-referential check audit:** If the code adds or modifies `isAlreadyImplemented()`, verify the field it checks is NOT written by the same strategy's `apply()`. If it is, add `isTaggingPreconditionMet()` 
3. **Package combo test:** If the code affects measure detection or savings, write a test with at least 2 measures in a package — single-measure tests miss interaction bugs
4. **Spreadsheet cross-check:** If the code affects financial calculations (savings, costs, payback), cross-check against the reference spreadsheet (`common-docs/Rev5 Inst. Cost Calculator Sheet 5-23-25.xlsx` or `Labs2Zero Score Calculator with 2025 Updates.xlsx`)

**Anti-pattern signal:** Any `isAlreadyImplemented(building)` method that references a field the same strategy's `apply()` writes

---

## Category 3: State Persistence Across Navigation

**Historical impact:** HIGH — Zone Matrix was the single most failure-prone feature

**What happens:** Values set in one part of the app are lost when the user navigates to another part and returns. Especially common in complex multi-tab UIs.

**Root causes:**
- Component state is local (useState) instead of store-backed (Zustand)
- API calls on mount overwrite user edits with server defaults
- No dirty-state tracking — the app can't distinguish "user edited this" from "default value"

**Checks:**
1. **Tab cycle test:** For every editable UI surface: edit → switch to another tab → switch back → verify edit persists
2. **Reload test:** Edit → hard refresh (F5) → verify edit persists (tests that the value was actually saved, not just held in memory)
3. **Concurrent edit test:** Edit field A in tab 1 → edit field B in tab 2 → verify A persists (tests store isolation)
4. **Mount-overwrite audit:** If the component fetches data on mount, verify it doesn't overwrite dirty (user-edited) state

**Anti-pattern signal:** Any `useEffect` that fetches data and sets state without checking for unsaved changes

---

## Category 4: UI Affordance Completeness

**Historical impact:** MEDIUM — visible to client during UAT

**What happens:** Missing tooltips, badges, modal overlays, toast notifications, or visual states that the design spec requires but developers don't implement because they focus on functional behavior.

**Root causes:**
- Developers test "does it work?" but not "does it look right in every state?"
- Secondary UI elements (tooltips, badges, hover states) are not in the acceptance criteria
- Error/success toast pairs are incomplete (success shows but error doesn't, or vice versa)

**Checks:**
1. **State matrix:** For every interactive element, list all visual states (default, hover, active, disabled, error, loading, empty) and verify each renders correctly
2. **Toast pairs:** If the code shows a success toast, verify there's a corresponding error toast for the failure path
3. **Tooltip coverage:** If the code adds a new parameter or UI element, verify it has a tooltip (or explicitly document why it doesn't)
4. **Modal backdrop:** If the code adds a modal, verify the backdrop covers the full viewport and clicking outside doesn't interact with background elements
5. **Badge lifecycle:** If the code adds a badge (e.g., "New", "Updated", "Key"), verify it appears AND disappears at the correct lifecycle points

**Anti-pattern signal:** Any new UI element without `data-test-id` attribute — makes E2E testing impossible

---

## Category 5: Cascade / Orphan Data

**Historical impact:** HIGH — data integrity issues

**What happens:** Deleting a parent entity doesn't clean up child entities, leaving orphan data. Or creating an entity doesn't properly link to its parent.

**Root causes:**
- DynamoDB single-table design makes cascade operations non-trivial
- Repository layer doesn't handle related entity cleanup
- No foreign-key constraints (NoSQL) — nothing prevents orphans

**Checks:**
1. **Delete cascade:** If the code creates a parent-child relationship, verify that deleting the parent also deletes (or marks for cleanup) all children
2. **Create linkage:** If the code creates a child entity, verify it references the correct parent
3. **Orphan scan:** After a delete operation, verify no child entities remain with a dangling parent reference

**Anti-pattern signal:** Any `delete` method that doesn't reference related entities

---

## Category 6: Error Path Completeness

**Historical impact:** MEDIUM — stuck loading states, unhandled failures

**What happens:** The happy path works, but error paths (API failures, validation errors, network timeouts) leave the app in a broken state.

**Root causes:**
- `try` without `catch` — status set to 'loading' but never reset on error
- API call failures not surfaced to user (no error toast)
- Optimistic updates without rollback on failure

**Checks:**
1. **Loading state reset:** For every async operation that sets a loading state, verify there's a catch block that resets it
2. **Error toast:** For every API call the code makes, verify there's user-facing error handling (toast, inline error, or state rollback)
3. **Rollback on failure:** For every optimistic update (UI changes before API confirms), verify there's a rollback path on API failure
4. **Network timeout:** If the code makes external API calls (ROI Tool, Google Maps, Stripe), verify timeout handling exists

**Anti-pattern signal:** Any `set({ status: 'loading' })` without a corresponding `catch` that sets `status: 'error'`

---

## Category 7: Migration / Data Model Evolution

**Historical impact:** MEDIUM — specific to Phase 3→4 transition

**What happens:** Existing buildings with Phase 3 data don't work correctly with Phase 4 code. Migration scripts assume a clean schema.

**Root causes:**
- Missing fields in old data
- Different naming conventions between phases
- Migration scripts not tested with real production data

**Checks:**
1. **Missing field handling:** For every field the code reads from a building entity, verify it handles the case where the field doesn't exist (Phase 3 buildings may not have it)
2. **Default fallback:** Verify that missing fields have sensible defaults
3. **Migration idempotency:** If the code includes a migration, verify it can run multiple times without corrupting data

**Anti-pattern signal:** Any code that reads a field with `building.aim.advanced.someField` without null-checking the chain

---

## Category 8: Cross-Feature Interaction (Combinatorial)

**Historical impact:** HIGH — only manifests when 2+ features interact

**What happens:** Individual features work in isolation but break when combined. Examples: Zone Matrix + Package calculations, Measure tagging + Parameter editing, Location change + Currency update.

**Root causes:**
- Unit tests cover features individually
- Integration tests don't cover the specific combination
- Event-driven side effects (EventEmitter) create non-obvious interactions

**Checks:**
1. **Feature pair test:** For every pair of features the code touches, write at least one test that exercises both in sequence
2. **Event chain trace:** If the code emits or handles domain events, trace the full event chain and verify no event handler undoes work from a previous handler
3. **Store interaction:** If the code writes to multiple Zustand stores, verify the writes are atomic (no partial state visible to other components)

**Anti-pattern signal:** Any `EventEmitter.emit()` without a corresponding test that verifies the event handler's side effects

---

## Category 9: Type-Safety Blind Spots

**Historical impact:** MEDIUM — silent bugs in projects using SWC/esbuild transpilation

**What happens:** TypeScript compiles without type-checking in test runners (Vitest + SWC/esbuild). Signature changes pass tests because missing/extra JS args become `undefined`.

**Root causes:**
- Vitest transpiles TypeScript without `tsc` type-checking
- Missing function arguments become `undefined` at runtime — no error, just wrong behavior
- Test files use old function signatures that still "pass" because JS is lenient

**Checks:**
1. **tsc --noEmit:** After any function signature change, run `tsc --noEmit` (not just `vitest`) across the whole project
2. **Signature blast radius:** Grep for every call site of any function whose signature changed — don't rely on the test suite to catch misses
3. **Build check:** Run the real build (not just tests) — `nest build`, `tsc -b`, frontend build — before declaring done

**Anti-pattern signal:** Any function signature change without a subsequent `tsc --noEmit` run
