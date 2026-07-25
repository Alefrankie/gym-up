# Session: 1.1

## Phase 0 — Rules Discovery
Base rules loaded: golden-rules.md, qa-anti-patterns.md.
Project rules: AGENTS.md (not found), CLAUDE.md (not found), .implement-rules.md (not found).
Quarantine learnings: crew-learnings.md (empty), .crew/crew-learnings.md (not found).
Pattern files: workout-tracking.flow.md (relevant to domain).

## User Decision
N/A (Fresh start)

## Phase 1 — Angel — Gap Analysis & Scope

### Angel — Problem Briefing

**What's happening:** Necesitamos crear la estructura base del proyecto Gym-Up usando Astro, SQLite y Vercel. El objetivo es tener un "esqueleto" funcional donde la capa de persistencia esté lista para ser intercambiada (SQLite para desarrollo/tests, Supabase para producción) sin tocar los componentes de UI.

**Why it happens:** Story 1.1 es el cimiento técnico. Sin esta infraestructura, no podemos implementar las funcionalidades de workout-tracking, nutrición o progreso. La decisión de usar clases abstractas (ADR-007) y composición por contexto (ADR-010) garantiza la escalabilidad y el aislamiento.

**Where it lives:** Proyecto vacío. Crearemos `src/lib/db/`, `src/lib/repositories/`, `src/lib/contexts/` y `src/pages/`.

**What done looks like:** Un proyecto Astro que ejecuta `npm run dev`, crea un archivo `.db` local y tiene una landing page funcional con la infraestructura de repositorios lista para el siguiente story.

---

### Gap Analysis

| Task / AC | Status | Evidence | Notes |
|-----------|--------|----------|-------|
| **T1.1-01** Create Astro project with vercel adapter | MISSING | N/A | Requiere `npm create astro` |
| **T1.1-02** Install SQLite driver + migration tool | MISSING | N/A | `better-sqlite3` + `drizzle-kit` |
| **T1.1-03** Create `db/client.ts` | MISSING | N/A | Conexión SQLite |
| **T1.1-04** Define abstract `XxxRepository` base classes | MISSING | N/A | Siguiendo ADR-007 |
| **T1.1-05** Create first `SqliteXxxRepository` | MISSING | N/A | Implementación concreta SQLite |
| **T1.1-06** Wire per-context composition root | MISSING | N/A | Siguiendo ADR-010 |
| **T1.1-07** Create base layout (`layout.astro`) | MISSING | N/A | Kebab-case (components.md) |
| **T1.1-08** Create landing page | MISSING | N/A | Ruta `/` |
| **T1.1-09** Verify dev server + DB file | NOT-STARTED | N/A | Paso final de validación |
| **AC-1.1-01** Astro project boots | MISSING | N/A | |
| **AC-1.1-02** SQLite file created | MISSING | N/A | |
| **AC-1.1-03** Abstract repos defined | MISSING | N/A | |
| **AC-1.1-04** Concrete impl wired | MISSING | N/A | |
| **AC-1.1-05** Landing page renders | MISSING | N/A | |
| **AC-1.1-06** Swappable for Supabase | MISSING | N/A | Claves en ADR-007 |

### Anti-pattern Edge Cases (Phase 0 Flags)
- **Category 6 (Error Paths):** `client.ts` debe manejar errores de conexión/inicialización de SQLite de forma robusta (no-swallow).
- **Category 9 (Type-Safety):** Los esquemas Drizzle deben ser estrictamente tipados y alineados con `database-schema.md`.

---
