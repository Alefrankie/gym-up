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
