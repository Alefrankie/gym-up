# Crew Learnings (Project Quarantine)

Project-scope rules not yet stable enough to integrate into project documentation. Graduate / decay / re-scope policy: `phase-5-fely-learning.md` Stage 4. Skill-scope rules belong in the skill's `crew-learnings.md`, not here.

---

trigger: "when using drizzle-kit for database migrations"
scope: project
confidence: 1
last-used: 2026-07-27
status: quarantine

---

Use `drizzle-kit push` during development for quick schema updates, and `drizzle-kit migrate` for production deployments. The migrate command requires proper journal updates and may not work as expected during rapid development. Reason: Project 1.3 migration didn't work with migrate, push was needed to apply schema changes.

---

trigger: "when updating database schema with new required fields"
scope: project
confidence: 1
last-used: 2026-07-27
status: quarantine

---

Update all test fixtures that create records in the modified table. The project uses in-memory SQLite databases for testing, so schema changes affect all tests immediately. Reason: Project 1.3 had 7 test failures after adding email and password_hash fields to profiles table.

---

trigger: "when implementing authentication in this project"
scope: project
confidence: 1
last-used: 2026-07-27
status: quarantine

---

The project uses a per-context architecture with composition roots. Auth context should be in `src/lib/contexts/auth/` with:
- `auth.types.ts` (interfaces)
- `local-auth.service.ts` (implementation)
- `sqlite-session.repository.ts` (session storage)
- `auth.composition.ts` (composition root)

Reason: Project 1.3 established this pattern for auth context.

---
trigger: "when a story says 'apply X to authenticated pages' but X is already used by public pages"
scope: project
confidence: 1
last-used: 2026-07-28
status: quarantine

---

Flag this as a DISCREPANCY in Phase 1 (Angel gap analysis), not as MISSING. The decision — extend X with a flag vs create a new layout — is a user-level architectural choice, not an implementation detail. Surface the question to the user before Julian starts. Reason: story-1.4 said "Apply `src/layouts/layout.astro` to all authenticated pages" but `layout.astro` was already the marketing layout used by landing/login/register. User explicitly chose option B (new AppLayout) over option A (extend layout.astro with showAppNav prop).

---
trigger: "when creating Astro files in src/layouts/"
scope: project
confidence: 1
last-used: 2026-07-28
status: quarantine

---

`docs/architecture/components.md:14-22` kebab-case rule applies to **layout files in `src/layouts/`** too, not just `src/components/`. Treat layout files as components for naming purposes. Reason: Julian named the new shell `AppLayout.astro` (PascalCase) following Astro community convention; Fely QA caught the violation per the project's explicit kebab-case rule. Renamed to `app-layout.astro`.

---
trigger: "writing form inputs in Astro components"
scope: project
confidence: 1
last-used: 2026-07-29
status: quarantine

---

When writing form inputs in Astro components, use `value` (not `defaultValue`) for the initial value of `<input>`. `defaultValue` is a React-only prop and is NOT in Astro's `InputHTMLAttributes`. The `value` attribute renders as the HTML `value` attribute, which sets the initial value when the page loads. `tsc --noEmit` (skill rule confidence 5) catches the mismatch with "Type 'X' is not assignable to type 'InputHTMLAttributes'". Reason: story 2.4 pre-fill of saved entries in `exercise-card.astro` initially used `defaultValue={entry?.reps}`; fixed to `value={entry?.reps}`.

---
trigger: "writing inline script in Astro component"
scope: project
confidence: 1
last-used: 2026-07-29
status: quarantine

---

When writing an inline `<script>` block in an Astro component (`.astro`), the script has its own ES module scope. Frontmatter imports (e.g., `import { createAutoSave } from '...'`) are NOT visible inside the script. Add the import at the top of the `<script>` block. The Astro typecheck catches this with "Cannot find name 'X'" inside the script. Reason: story 2.4 workout page script called `createAutoSave(...)` without importing it inside the script; fixed by adding `import { createAutoSave } from '../../lib/client/auto-save';` at the top of the `<script>` block.
