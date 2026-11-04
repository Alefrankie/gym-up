# AGENTS.md

## Decisions (DDE)
<!-- Paste into AGENTS.md / CLAUDE.md / .cursorrules. Method: https://github.com/<you>/dde -->
- Read PRODUCT.md and decisions/ before proposing a change that is not trivial.
- Compute the tier: reversibility (easy | costly | one-way) × scope (local | cross-team | system).
  T0 = no record. Security/privacy/compliance → at least T2. One-way + any risk → T3.
- Write the record in decisions/DR-NNNN-slug.md when proposing, not after building.
- You may propose any tier. You may accept only T1, and only if the team enabled it.
- Status must match reality: implemented needs a code/PR link; validated needs evidence a human can check.
- Never rewrite an accepted record: add a Log line or supersede it with a new one.
- Do not state hypotheses as facts. A record is not permission to touch real data.
- Legacy ids: `ADR-0NN` in code and docs is `DR-00NN` in decisions/ (see each record's `legacy_id`).
- Check a record: `node <dde>/tools/cli/dde.mjs lint --dir decisions`; regenerate the index with `... index --dir decisions`.
