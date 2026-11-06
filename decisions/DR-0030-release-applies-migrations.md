---
id: DR-0030
title: "Release applies pending D1 migrations before deploying the API"
status: proposed
tier: 2
date: 2026-11-06
owner: "@alefrank"
deciders: ["@alefrank"]
decided_by: null

scope: system
reversibility: easy
risk_flags: [data]

depends_on: [DR-0027]
supersedes: []
superseded_by: null
conflicts_with: []

links:
  code:
    - "scripts/release.mjs"
    - "apps/api/db/migrations/"
  issues: []
  prs: []

validation:
  criteria:
    - "A release applies every pending migration to the production D1 database before the worker that depends on it is deployed"
    - "A release with nothing pending is a no-op and still succeeds"
    - "A migration that fails stops the release before the deploy, leaving production on the previous code"
  review_by: null
  evidence: []
  validated_on: null

tags: [release, infra, database]
---

# DR-0030 · Release applies pending D1 migrations before deploying the API

## Context

`scripts/release.mjs` builds the worker, deploys it and publishes the web app. It never touched the D1
schema: applying migrations was a manual step documented in `docs/architecture/system.md`
(`pnpm --filter @gym-up/api d1:migrate:remote`).

Every feature with a migration therefore depended on somebody remembering that step, and nothing in the
pipeline noticed when they did not.

## Incident that motivated this record (2026-11-06)

The recipe book ([DR-0029](./DR-0029-recipe-book.md)) merged and its release deployed the API at 13:03 UTC.
Migration `0026_recipes.sql` had not been applied to the production database, which was still at
`0025_profile_soft_delete.sql`, so the seven `recipe*` tables did not exist and every `/recipes` request
answered **500 internal server error**. The code was correct; the schema was behind.

The fix applied to production at 14:12 UTC was the pending migration on its own: seven `CREATE TABLE` and
six `CREATE INDEX` statements, additive, no `ALTER` and no data touched. After it, all `/recipes` endpoints
answer normally.

## Decision

The release applies `wrangler d1 migrations apply gym-up --remote` after building the worker and before
deploying it, with the same Cloudflare credentials the deploy already uses. In a non-interactive run
wrangler confirms by itself; with nothing pending the command is a no-op.

Order matters: schema first, code second. A deployed worker that queries a table its migration has not
created is exactly the outage above, while a schema ahead of the code is harmless because the previous
worker does not know the new tables.

`run()` exits on a non-zero status, so a failing migration stops the release before the deploy and
production keeps running the previous version.

## Alternatives considered

- **Keep it manual.** Rejected: it already failed once, silently, and the failure looks like a code bug
  from the outside. The step is deterministic, so the pipeline can own it.
- **Migrate inside the worker on first request.** Rejected: a request path that mutates the schema serialises
  every cold start behind a DDL statement, and a failed migration would surface as a 500 per request instead
  of a failed release.
- **Apply migrations after the deploy.** Rejected: it widens the window in which the new worker runs against
  the old schema, which is the failure being removed.

## Consequences

- A release now changes the production schema, so a migration is reviewed as part of the commit that ships it
  and a broken one blocks the release instead of production traffic.
- Automatic application is forward-only. Rolling back a release does not roll back its migration; a revert
  needs its own migration, the same rule [DR-0016](./DR-0016-workout-data-model-v2.md) follows for schema
  evolution.
- The manual commands stay in `apps/api/package.json` for local work and for emergencies.
