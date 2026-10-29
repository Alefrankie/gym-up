# ADR-002: Chart.js via React Island

Parent: [./readme.md](./readme.md) · Up: [../../README.md](../../README.md)

**Status:** Superseded by [ADR-027](./027-mobile-architecture-nestjs-sveltekit-tauri.md) (2026-10-29) · **Date:** 2026-07-21

## Context

Need to render progress charts. Astro supports islands from React.

## Decision

Use Chart.js with React via `react-chartjs-2`, rendered as React island.

## Rationale

- React only loads for charts, not entire app
- Chart.js lightweight (~60KB gzipped)
- Responsive out of box

## Consequences

- Install `react`, `react-dom`, `chart.js`, `react-chartjs-2`
- Chart components are `.tsx` not `.astro`

## Referenced by

- [progress](../../prd/features/progress.md)
