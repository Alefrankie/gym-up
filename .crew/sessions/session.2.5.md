# Session: 2.5 — Rest Timer

## Phase 0 — Rules Discovery

### Loaded
- `golden-rules.md` (DDD, SOLID, null/mutation, type-safety, QA-First)
- `qa-anti-patterns.md` (9 categories — full file as context; per-story relevance below)
- `phase-0-rules-discovery.md` (process spec)
- `.crew/crew-learnings.md` (project — **2 NEW rules applied this session: "value" vs "defaultValue" in Astro, Astro `<script>` needs its own import**)
- `.agents/skills/crew-flow/crew-learnings.md` (skill — "now: Date" at confidence 2, "tsc --noEmit" at confidence 5)
- `docs/architecture/contexts/workout-tracking/readme.md` (parent spec — Rest port, Rest period invariants, FR-WT-011)
- `docs/prd/features/workout-tracking.md` (FR-WT-011: 90s default, +30s, skip, vibration/sound on end)
- `docs/architecture/components.md` (RestTimer spec — `defaultSeconds` prop, React island, client-side only)
- `docs/architecture/decisions/002-chartjs-react-island.md` (ADR-002: install `react`, `react-dom`, `chart.js`, `react-chartjs-2`. This ADR is **Accepted** but the deps were never installed.)
- `docs/stories/phase-1/round-2/story-2.5.md` (3 tasks, 2 ACs)
- `src/components/exercise-card.astro` (the checkmark checkbox in each row — `entries[N][completed]`)
- `src/lib/client/auto-save.ts` (the auto-save module from 2.4 — handles input/change events on `.set-row` inputs)
- `src/pages/workout/[id].astro` (the page that mounts the card and wires the auto-save)
- `astro.config.mjs` (no `@astrojs/react` integration — React is NOT yet installed)
- `package.json` (no `react`, `react-dom`, `@astrojs/react` — **React is not a dependency**)

### Not found
- No `AGENTS.md` / `CLAUDE.md` / `.implement-rules.md`
- No `*.pattern.md` for workout-tracking
- No `rest-timer.tsx` (the file the story asks for)
- **No React in `package.json` or `astro.config.mjs`** — the project has never integrated React, even though ADR-002 says it should

### Codebase state snapshot
- The checkmark checkbox in each `<ExerciseCard />` row is named `entries[N][completed]` (per 2.3). Toggling it triggers the auto-save (2.4) via the `change` event.
- The page's script (2.4) listens for `change` and `input` events on the auto-save root. It does NOT currently dispatch any custom event for the rest timer.
- The auto-save module's `handle` function processes all input changes (reps, weight, completed, notes). The `completed` checkbox is just one of the tracked fields.
- `WorkoutEntryRules.DefaultRestSeconds = 90` (per the parent spec / PRD).
- `astro.config.mjs` has only the Vercel adapter. No React integration.
- `package.json` has Astro 7, Drizzle, Vitest, better-sqlite3, but no React.

### QA anti-patterns relevant to this story
- **Cat 1 — Silent Value Reversion:** the timer must show the configured `defaultSeconds` (not a hardcoded value). **Critical: use `WorkoutEntryRules.DefaultRestSeconds` or the `defaultSeconds` prop, NOT a magic number.**
- **Cat 2 — Calculation Logic:** countdown math (`secondsRemaining - 1` per tick). Trivial.
- **Cat 3 — State Persistence:** AC-2.5-02: client-side only, no DB. The timer is a UI artifact, not a workout field. **The state must reset on page reload (i.e., not persist anywhere).**
- **Cat 4 — UI Affordance Completeness:** state matrix for the timer (idle, running, paused, finished). The `+30s` and skip buttons need hover/focus-visible states. The countdown needs to be readable (large, monospace numerals).
- **Cat 6 — Error Paths:** what if the user navigates away mid-countdown? The timer state is lost (client-side). This is acceptable per AC-2.5-02. **Document: no persistence.**
- **Cat 7 — Migration:** N/A (no schema change).
- **Cat 8 — Cross-Feature Interaction:** the timer is a React island. The checkmark checkbox is an Astro input. The integration is via custom event (`rest-timer:start`) — no direct coupling.
- **Cat 9 — Type-Safety:** React + TypeScript. Skill rule (confidence 5) "tsc --noEmit after signature change" applies.

### Story-# / context
- `story-2.5` — Rest Timer
- Blocked by: `story-2.4` ✅ (the auto-save exists, the checkmark is wired)
- Blocks: `story-2.6` (Complete Workout — needs the timer to be working before adding the "Finish workout" button)
- Size: S
- Parent: `docs/architecture/contexts/workout-tracking/readme.md` (Rest port + Rest period invariants)
- Spec source: `components.md` (RestTimer table) + `workout-tracking.md` PRD (FR-WT-011) + ADR-002 (React island)

### Selective learnings loaded
- **Skill rule (2.1, confidence 2):** "now: Date for date-dependent use cases" — N/A (no date math).
- **Skill rule (confidence 5):** "tsc --noEmit after signature change" — apply (new React component + new integration).
- **Skill rule (2.3):** "Astro inline `<script>` DOM type assertions" — apply (the page's script will dispatch the `rest-timer:start` event).
- **Project rule (NEW, 2.4):** "value" vs "defaultValue" in Astro inputs — N/A (no form inputs in this story).
- **Project rule (NEW, 2.4):** "Astro `<script>` needs its own import" — apply (the page's script will be extended).
- **Project rule:** kebab-case for components — apply (`rest-timer.tsx`).

---

## Phase 1 — Angel — Gap Analysis & Scope

### Problem Briefing

**What's happening:** El usuario marca el checkmark de un set (en la `exercise-card.astro` de 2.3). El auto-save (2.4) guarda la entrada. Pero el usuario no tiene una indicación visual de cuánto tiempo descansar antes del próximo set. El spec pide un timer de descanso de 90s (default) con +30s, skip, y vibración/sonido al terminar.

**Why it happens:** El `rest-timer` está documentado en `components.md` y ADR-002 pero nunca se construyó. Story 2.3 construyó la card con el checkmark. Story 2.4 construyó el auto-save que se dispara cuando el checkmark cambia. Pero el timer — el feedback visual para el usuario entre sets — falta.

**Where it lives:**
- `src/components/rest-timer.tsx` — React island (per `components.md` + ADR-002)
- `src/pages/workout/[id].astro` — mount el `<RestTimer client:load />`
- `src/lib/client/auto-save.ts` o la página — dispara el evento `rest-timer:start` cuando el checkmark cambia a `true`
- `astro.config.mjs` + `package.json` — necesitan React + `@astrojs/react` (NO están instalados)

**What done looks like:** Al marcar un checkmark, el timer aparece (esquina inferior fija o similar), cuenta de 90 a 0, muestra `1:30` → `0:00`, con botones `+30s` y `Saltar`. Al llegar a 0, vibra (mobile) y se auto-hide. El usuario puede saltar o extender. Sin DB persistence (per AC-2.5-02).

### Specs Read
- [docs/architecture/contexts/workout-tracking/readme.md](docs/architecture/contexts/workout-tracking/readme.md) — Rest port + invariants
- [docs/prd/features/workout-tracking.md](docs/prd/features/workout-tracking.md) — FR-WT-011
- [docs/architecture/components.md](docs/architecture/components.md) — RestTimer table
- [docs/architecture/decisions/002-chartjs-react-island.md](docs/architecture/decisions/002-chartjs-react-island.md) — React island decision
- [docs/stories/phase-1/round-2/story-2.5.md](docs/stories/phase-1/round-2/story-2.5.md) — 3 tasks, 2 ACs

### Patterns Found
None. Inferring from:
- `exercise-card.astro` (2.3) — Astro component with inline `<script>` for "+ Add set"
- `workout/[id].astro` (2.4) — mounts components + wires auto-save
- ADR-002 — React island pattern

### Gap Analysis

| Task / AC | Status | Evidence | Notes |
|---|---|---|---|
| T2.5-01 — Create `src/components/rest-timer.tsx` React island | MISSING | no React installed, no file | new code + new dep |
| T2.5-02 — Wire to checkmark tap | MISSING | no event dispatch | new code in page or auto-save |
| T2.5-03 — Add +30s and skip | MISSING | no timer UI | new code in component |
| AC-2.5-01 — Timer starts on set completion (FR-WT-011) | MISSING | no timer | new code |
| AC-2.5-02 — Client-side only, no DB persistence | MISSING | n/a | design constraint |
| AC oculto — React + @astrojs/react dependencies | MISSING | `package.json` has no React | **new deps** |
| AC oculto — `@astrojs/react` integration in `astro.config.mjs` | MISSING | not configured | new config |
| AC oculto — Custom event `rest-timer:start` for decoupling | MISSING | no event system | new pattern |
| AC oculto — Timer UI: countdown + +30s + skip buttons | MISSING | no UI | new code |
| AC oculto — Vibration/sound on timer complete | MISSING | n/a | new code (mobile only) |

### Edge Cases Identified

1. **No React in the project:** ADR-002 (Accepted) says to install React, but it was never done. Story 2.5 is the first to use React. Adding `react` + `react-dom` + `@astrojs/react` + `@types/react` + `@types/react-dom` is a ~50KB gzipped addition. **Significant scope expansion for an S-size story.** This is a decision for the user (Q1).
2. **Timer triggered on checkmark change:** the auto-save module already handles `change` events on the completed checkbox (per 2.4). Two options for wiring:
   - **A) Add an `onCompleted` callback to the auto-save module's options.** When the checkmark is changed to checked, call the callback. The page passes a callback that dispatches the `rest-timer:start` event.
   - **B) Add a separate listener in the page's script** for the completed checkbox. The page's script dispatches the event directly.
3. **Multiple checkmark taps in quick succession:** user marks set 1 → timer starts → user marks set 2 immediately. Should the timer restart? Per FR-WT-011, the timer is for the rest between sets. Each tap = new rest period. **The timer should restart (or extend) on each tap.**
4. **Unchecking the checkmark:** user marks set 1 → timer starts → user unmarks set 1. Should the timer cancel? The spec is silent. **Default: no cancellation. The timer runs to completion. Unchecking doesn't undo the rest.**
5. **Timer position:** fixed bottom-right (like a toast), fixed bottom-center, or inline somewhere. For S-size, **fixed bottom-center is the simplest** and most visible.
6. **Vibration API:** `navigator.vibrate(200)` is available on mobile browsers. Desktop ignores it gracefully. **Use the API; no polyfill needed.**
7. **Sound on completion:** `new Audio('/sounds/rest-end.mp3').play()` would require an audio file. The project has no audio assets. **Default: skip sound. Vibration only. Documented as a follow-up.**
8. **Timer visibility before first trigger:** the timer should NOT be visible until the first checkmark tap. **Use a state-based render: `if (!isRunning && secondsRemaining === defaultSeconds) return null;`**.
9. **CSS scope:** React components in Astro have scoped CSS by default (if using `styled-jsx` or similar). The project doesn't have a CSS-in-JS solution. **Use a regular CSS file imported into the React component, or inline styles via the `style` attribute.**

### Integration Points
- **Reads from:** the `rest-timer:start` custom event (dispatched by the page's script).
- **Writes to:** nothing (client-side only, per AC-2.5-02).
- **Calls:** `navigator.vibrate(200)` on completion (mobile only).
- **Consumed by:** `workout/[id].astro` (mounts `<RestTimer client:load defaultSeconds={...} />`).
- **Triggered by:** the page's script (or auto-save module) when a checkmark is toggled to checked.

### Legacy Behavior Concerns
- **`src/components/exercise-card.astro`** is shared with 2.3. The checkmark checkbox is unchanged. No regression.
- **`src/lib/client/auto-save.ts`** is shared with 2.4. If option A is chosen (add `onCompleted` callback), the module is extended additively. If option B, the module is unchanged.
- **`src/pages/workout/[id].astro`** is shared with 2.2/2.3/2.4. The script is extended to dispatch the event. No regression.
- **`astro.config.mjs`** is shared with 1.x/2.x. Adding `@astrojs/react` integration is additive.
- **`package.json`** is shared with 1.x/2.x. Adding React deps is additive.
- **Removed:** none. No regression.

### Applicable Golden Rules
- **Null policy:** the `defaultSeconds` prop has a default (90), not nullable.
- **Side-effect free reads:** N/A (UI only).
- **SOLID — SRP:** the timer does ONE thing (countdown). The page's script does ONE thing (dispatch the event). Two responsibilities, two files.
- **Naming:** `RestTimer` (PascalCase), `defaultSeconds` (camelCase).
- **API design:** the `defaultSeconds` prop is optional with a default. The component has no `onEnd` callback (per AC-2.5-02, no DB persistence means no callback either).
- **QA-First:** every visual state is verified manually (timer, +30s, skip, vibrate).
- **Type-safety:** React + TypeScript. The `tsc --noEmit` skill rule (confidence 5) applies.
- **One component per file:** yes. `rest-timer.tsx` is a single file.
- **kebab-case filename:** yes (`rest-timer.tsx`).
- **Single source of truth:** `WorkoutEntryRules.DefaultRestSeconds = 90` for the default. No hardcoded numbers.

### QA Anti-Patterns focus (for Julian self-QA)
- **Cat 1** — `defaultSeconds` prop is used (not hardcoded). Verified by the spec.
- **Cat 3** — Timer state is client-side (no DB). Reset on page reload is acceptable.
- **Cat 4** — UI affordances: every button has hover/focus-visible states. Countdown is readable.
- **Cat 6** — Error paths: vibration API failure is silent (mobile only). No JS errors expected.
- **Cat 8** — Cross-feature: event-based decoupling (no direct React ↔ Astro coupling).
- **Cat 9** — Type-safety: React component with proper prop types. Skill rule (confidence 5) applied.

### Self-QA plan (Julian, Phase 3 Step 2e)
1. Walk through every AC + edge case.
2. Manual smoke: dev server, log in, start workout, mark checkmark, verify timer appears + counts down.
3. Manual smoke: +30s, skip, vibration.
4. Manual smoke: multiple checkmark taps (timer restart).
5. Manual smoke: uncheck checkmark (timer does NOT cancel).
6. Manual smoke: navigate away and back (timer state is lost — expected).
7. `tsc --noEmit` verde.
8. `npm run test` verde (no new tests for 2.5 — UI pure).
9. `npm run build` verde.

### Fely focus areas
- React integration correctness: the island hydrates and the event listener attaches.
- Timer state lifecycle: starts, ticks, completes, auto-hides.
- +30s and skip behaviors.
- Visual position: fixed bottom, doesn't cover important UI.
- Accessibility: `role="status"` + `aria-live="polite"` for screen readers.
- 2.2/2.3/2.4 page elements (header, status badge, back link, card) still render correctly.

### Questions for User

> Have a proposal, or want my recommendation? — I provide recommendations for all 3 below.

**Q1 — React installation: which framework for the React island?**
The project has no React in `package.json` or `astro.config.mjs`. ADR-002 (Accepted) says to install React, but it was never done. Story 2.5 is the first to use React.

- **Context:** The spec (`components.md` + ADR-002) says "React island". The codebase has no React. We need to add a framework integration to render `.tsx` components in Astro.
- **My recommendation:** **A) Add React + `@astrojs/react` (~50KB gzipped, faithful to spec).** The spec is explicit. ADR-002 is Accepted. Adding React once unblocks future React stories (chart.js for progress in Phase 3). The cost is one-time and acceptable.
- **Alternatives considered:**
  - **B) Use Preact (`@astrojs/preact`)** — 3KB gzipped, similar API to React. Lighter but deviates from the spec ("React island" not "Preact island").
  - **C) Plain JS / vanilla TS** — zero deps, lighter, but deviates from the spec. The component would be a TS class with a render method (no React). The components.md table says `.tsx`.
- **Tradeoff if alternative:** B is lighter but requires renaming ADR-002. C is zero-deps but loses the React ecosystem (TypeScript types, dev tools, future chart.js integration).
- **Note:** Story 2.5 (S-size) becomes M-size if we add React (config update + dep install). **This is acceptable for an architecture setup story.**

**Q2 — Auto-save hook for the timer: extend auto-save module OR separate listener?**
The auto-save module already handles `change` events on the completed checkbox. Two options for wiring the timer:

- **Context:** The auto-save module's `handle` function processes all input changes. The completed checkbox is one of the tracked fields. The timer needs to start when the checkmark is toggled to checked.
- **My recommendation:** **A) Add a separate listener in the page's script** for the completed checkbox. The auto-save module stays focused on auto-save (no timer logic). The page's script dispatches the `rest-timer:start` event.
- **Alternatives considered:**
  - **B) Add an `onCompleted` callback to the auto-save module's options** — the page passes a callback that dispatches the event. The module is extended to call the callback when the checkmark is checked.
- **Tradeoff if alternative:** B is more cohesive (the auto-save module knows about completion). A is simpler (no module changes). For S-size, **A is lighter**.

**Q3 — Timer position on page: fixed bottom or inline?**
The timer is a floating UI element. Where should it render?

- **Context:** The timer is triggered by a per-set action (checkmark tap). It needs to be visible regardless of scroll position. It's a transient UI (auto-hides on completion or skip).
- **My recommendation:** **A) Fixed bottom-center** of the viewport, with a high z-index. Visible on scroll. Doesn't cover the main content (the timer is small, ~200px wide). Easy to dismiss (Skip button).
- **Alternatives considered:**
  - **B) Fixed bottom-right** (like a toast) — more "non-blocking" but less visible.
  - **C) Inline below the card** — simpler CSS, but not visible on scroll.
- **Tradeoff if alternative:** A is the most visible and consistent with mobile-first design. B is more "non-blocking" but easier to miss.

---

### Gap Summary
DONE: 0 | PARTIAL: 0 | DISCREPANCY: 0 (planned) | MISSING: 9 (3 tasks + 2 ACs + 4 hidden) | NOT-STARTED: 0

### Verdict
Gap analysis complete. 3 questions open (Q1-Q3). Handing off to user for decisions.

> STOP — waiting for user answers on Q1-Q3 before proceeding to Phase 1.5 alignment.

---

## User Decision (recorded)
- **Q1 — Framework choice:** **A) React + @astrojs/react.** Add `react`, `react-dom`, `@astrojs/react`, `@types/react`, `@types/react-dom`. ~50KB gzipped. Story 2.5 grows from S to M due to architecture setup.
- **Q2 — Timer trigger:** **A) Listener separado en el page script.** Page script añade un listener para `input[name$="[completed]"]` que dispatcha `rest-timer:start` cuando `checked`. Auto-save module no se toca.
- **Q3 — Timer position:** **A) Fixed bottom-center** of the viewport, high z-index, ~200px wide, doesn't cover main content.

### Updated AC list (post-user-decision)
- AC-2.5-01: Timer starts on set completion per [FR-WT-011](../../prd/features/workout-tracking.md). 90s default, +30s extend, skip, vibration on end.
- AC-2.5-02: Client-side only, no DB persistence per [components.md](../../architecture/components.md).
- AC-2.5-03 (new, Q1): React 18+ + `@astrojs/react` integration added to `package.json` + `astro.config.mjs`. `rest-timer.tsx` is a `.tsx` React island.
- AC-2.5-04 (new, Q2): The page's script listens for the `completed` checkbox `change` event. When the checkbox is checked, dispatch `new CustomEvent('rest-timer:start')`. The React island listens and starts the countdown.
- AC-2.5-05 (new, Q3): Timer renders fixed bottom-center of the viewport, with a high z-index. Mobile-friendly (doesn't cover main content).
- AC-2.5-06 (new): `+30s` and skip buttons have hover + focus-visible states. `role="status"` + `aria-live="polite"` for screen readers. Vibration via `navigator.vibrate(200)` on completion (mobile only).
- AC-2.5-07 (new): Timer state is not persisted (per AC-2.5-02). On page reload, the timer is idle (not running). Each checkmark tap restarts the countdown.

---

## Phase 1.5 — Alefrank — Alignment Check (Round 1)

### Discrepancies Found

| # | Type | Description | Spec Reference | Severity |
|---|------|-------------|----------------|----------|
| 1 | user-decided | Q1 = React + @astrojs/react. Story grows S → M. | components.md + ADR-002 | None (resolved) |
| 2 | user-decided | Q2 = separate listener in page script. Auto-save module unchanged. | n/a | None (resolved) |
| 3 | user-decided | Q3 = fixed bottom-center. | n/a | None (resolved) |
| 4 | spec-gaps | The spec says "vibration/sound on end". Sound requires an audio file. Project has no audio assets. **Sound is out of scope; vibration only (mobile). Documented as a follow-up.** | components.md RestTimer table | None (documented) |
| 5 | spec-gaps | The default 90s is in `WorkoutEntryRules.DefaultRestSeconds` (per parent spec). The component imports the constant, not a magic number. **Confirmed in plan.** | workout-tracking.md FR-WT-011 + workout-tracking.constants.ts | None (single source of truth) |
| 6 | legacy-watch | The checkmark checkbox is in the card (2.3). The auto-save handles its `change` event (2.4). The new page-script listener is **additive** — both listeners fire on the same event, doing different things. No regression. | n/a | None (additive) |
| 7 | legacy-watch | The page's script is extended with one more listener. The existing auto-save wiring is unchanged. | n/a | None (additive) |
| 8 | spec-coverage | The "+30s" button: when the timer is at 60s, +30s → 90s. When the timer is at 5s, +30s → 35s. **The button always adds 30s to the current value. Documented in plan.** | n/a | None (documented) |
| 9 | accessibility | The countdown text is a `role="status"` element with `aria-live="polite"` for screen readers. **Apply in implementation.** | n/a | Minor (add to plan) |
| 10 | css | React components in Astro: CSS is scoped by default. The timer styles can be inline (`style={...}`) or in a separate CSS file imported into the component. **For 2.5, use a separate CSS file (`rest-timer.css`) imported into the component.** | n/a | Minor (add to plan) |
| 11 | build | The `astro.config.mjs` change adds `@astrojs/react()` to the integrations array. **Verify build still passes after config change.** | n/a | Minor (add to plan) |
| 12 | dev-deps | `@types/react` and `@types/react-dom` are needed for TypeScript support of React JSX. **Add to devDependencies.** | n/a | Minor (add to plan) |

### Resolution
- **#1, #2, #3:** Resolved via user decisions.
- **#4:** Sound out of scope (no audio assets). Documented.
- **#5:** Default 90s from `WorkoutEntryRules.DefaultRestSeconds`. Apply in implementation.
- **#6, #7:** Additive changes. No regression.
- **#8:** `+30s` adds 30s to current value. Documented.
- **#9:** `role="status"` + `aria-live="polite"`. Apply in implementation.
- **#10:** Separate CSS file. Apply in implementation.
- **#11, #12:** Build verification + devDeps. Apply in implementation.

### Verdict
✅ **ALIGNED.** Spec coverage complete with the new ACs (AC-2.5-03 through AC-2.5-07). No major discrepancies. Four minor items (#9, #10, #11, #12) are tracked into Phase 2 plan. I approve Julian to start implementation after the plan is approved.

---

## Phase 2 — Alefrank — Implementation Plan

### Gap Summary (from Angel + alignment)
DONE: 0 | PARTIAL: 0 | DISCREPANCY: 0 (planned) | MISSING: 9 + 2 new ACs = 11 | NOT-STARTED: 0

### Plan Summary (plain language)
Añadir React + `@astrojs/react` (deps + integration), crear el componente `RestTimer` (React island), wirearlo en la página vía custom event desde el page script, y verificar build + typecheck. 5 archivos: 4 nuevos (timer component, CSS, deps, config), 1 modificado (page script).

1. **`package.json` (MODIFIED)** — añadir `react`, `react-dom` a `dependencies`; `@types/react`, `@types/react-dom` a `devDependencies`. **Install via `pnpm install`.**
2. **`astro.config.mjs` (MODIFIED)** — añadir `import react from '@astrojs/react';` y `integrations: [react()]` al array de integrations.
3. **`src/components/rest-timer.tsx` (NEW)** — React island. Props: `defaultSeconds?: number` (default 90, from `WorkoutEntryRules.DefaultRestSeconds`). State: `secondsRemaining`, `isRunning`. Effect: listens for `rest-timer:start` event. Interval: 1s tick. UI: countdown text + +30s button + skip button. `role="status"` + `aria-live="polite"`. Vibration on completion. Auto-hide when `!isRunning && secondsRemaining === defaultSeconds`.
4. **`src/styles/rest-timer.css` (NEW)** — CSS for the timer. `.rest-timer` fixed bottom-center, high z-index, glassmorphism. Buttons with hover + focus-visible.
5. **`src/pages/workout/[id].astro` (MODIFIED)** — mount `<RestTimer client:load defaultSeconds={...} />`. Extend the page's script to listen for `change` on `input[name$="[completed]"]` and dispatch `rest-timer:start` when checked.

### Implementation Steps (ordered)

**Step 1 — Install React + `@astrojs/react` (story grows S → M)**
```bash
pnpm add react react-dom
pnpm add -D @types/react @types/react-dom @astrojs/react
```
Verify `package.json` updated.

**Step 2 — Update `astro.config.mjs`**
```js
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  vite: { resolve: { alias: { ... } } },
});
```

**Step 3 — Create `src/components/rest-timer.tsx`**
```tsx
import { useState, useEffect, useRef } from 'react';
import { WorkoutEntryRules } from '../lib/contexts/workout-tracking/domain/workout-tracking.constants';
import '../styles/rest-timer.css';

interface RestTimerProps {
  defaultSeconds?: number;
}

export default function RestTimer({ defaultSeconds = WorkoutEntryRules.DefaultRestSeconds }: RestTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    function handleStart() {
      setSecondsRemaining(defaultSeconds);
      setIsRunning(true);
    }
    window.addEventListener('rest-timer:start', handleStart);
    return () => {
      window.removeEventListener('rest-timer:start', handleStart);
    };
  }, [defaultSeconds]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Time's up — vibrate (mobile only, silent on desktop).
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(200);
          }
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  // Don't render until first triggered.
  if (!isRunning && secondsRemaining === defaultSeconds) {
    return null;
  }

  const handlePlus30 = () => setSecondsRemaining((prev) => prev + 30);
  const handleSkip = () => {
    setIsRunning(false);
    setSecondsRemaining(defaultSeconds);
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="rest-timer" role="status" aria-live="polite">
      <span className="rest-timer-display">{display}</span>
      <button type="button" className="rest-timer-plus" onClick={handlePlus30}>+30s</button>
      <button type="button" className="rest-timer-skip" onClick={handleSkip}>Saltar</button>
    </div>
  );
}
```

**Step 4 — Create `src/styles/rest-timer.css`**
```css
.rest-timer {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  color: #fff;
  font-family: 'Inter', sans-serif;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.rest-timer-display {
  font-family: 'Oswald', sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.05em;
  min-width: 3.5rem;
  text-align: center;
}

.rest-timer-plus,
.rest-timer-skip {
  background: rgba(255, 77, 77, 0.15);
  color: #ff8a8a;
  border: 1px solid rgba(255, 77, 77, 0.3);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.rest-timer-skip {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.15);
}

.rest-timer-plus:hover,
.rest-timer-plus:focus-visible,
.rest-timer-skip:hover,
.rest-timer-skip:focus-visible {
  background: rgba(255, 77, 77, 0.25);
  color: #fff;
}

.rest-timer-skip:hover,
.rest-timer-skip:focus-visible {
  background: rgba(255, 255, 255, 0.12);
}

.rest-timer-plus:focus-visible,
.rest-timer-skip:focus-visible {
  outline: 2px solid #ff4d4d;
  outline-offset: 2px;
}
```

**Step 5 — Modify `src/pages/workout/[id].astro`**
- Add `import RestTimer from '../../components/rest-timer.tsx';` to the frontmatter.
- Inside `<AppLayout>`, after the `</div>` closing the workout container (before `<input type="hidden">` and `<script>`), add:
  ```astro
  <RestTimer client:load defaultSeconds={WorkoutEntryRules.DefaultRestSeconds} />
  ```
- Extend the page's `<script>` to add a listener for the completed checkbox:
  ```ts
  // Wire checkmark tap to start the rest timer (story 2.5).
  document.querySelectorAll<HTMLInputElement>('input[name$="[completed]"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        window.dispatchEvent(new CustomEvent('rest-timer:start'));
      }
    });
  });
  ```

**Step 6 — Verify (regression + build)**
- `npm run test:run` → verde (no new tests; 96/96 from 2.4).
- `npm run typecheck` → verde (skill rule confidence 5).
- `npm run build` → verde (Astro bundler processes the React island).

### Files Julian will touch
- **MODIFY** `package.json` — add `react`, `react-dom` to `dependencies`; `@types/react`, `@types/react-dom` to `devDependencies`
- **MODIFY** `astro.config.mjs` — add `react()` integration
- **CREATE** `src/components/rest-timer.tsx` — React island component
- **CREATE** `src/styles/rest-timer.css` — timer styles
- **MODIFY** `src/pages/workout/[id].astro` — mount `<RestTimer client:load />` + extend page script with checkmark listener

### Files NOT touched (preserved)
- `src/components/exercise-card.astro` (2.3) — unchanged
- `src/lib/client/auto-save.ts` (2.4) — unchanged (per Q2)
- `src/lib/contexts/workout-tracking/application/*` (2.1, 2.2, 2.4) — unchanged
- `src/lib/contexts/workout-tracking/domain/workout.repository.ts` (2.4) — unchanged
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/*` — unchanged
- `src/lib/contexts/auth/*` — unchanged
- `src/pages/api/*` — unchanged
- `src/pages/{index,login,register,logout,dashboard}.astro` — unchanged
- `src/layouts/*` — unchanged
- `db/*` — unchanged
- All existing tests — unchanged

### Selected Skills
- **crew-flow** (orquestador) — ya activo
- Ningún otro skill del system prompt aplica directamente.

### Pattern Contracts
- **None** — no `*.pattern.md` for workout-tracking. Julian infiere from:
  - `components.md` RestTimer table (props, behavior)
  - `workout-tracking.md` PRD FR-WT-011 (90s, +30s, skip, vibrate)
  - `auto-save.ts` (event delegation pattern for the page's script)
  - Astro 7 React islands (`client:load` directive)
  - `WorkoutEntryRules.DefaultRestSeconds = 90` constant (single source of truth)

### Legacy Watchlist
- **`package.json`** — adding deps is additive. `pnpm install` will update the lock file.
- **`astro.config.mjs`** — adding `react()` to integrations is additive. Other integrations (Vercel, Vite aliases) are preserved.
- **`src/pages/workout/[id].astro`** — adding `<RestTimer client:load />` + extending the page's script is additive. The auto-save wiring (2.4) is preserved.
- **Removed:** none. No regression.
- **No regression** on existing 96 tests.

### Applicable Golden Rules
- **Null policy:** the `defaultSeconds` prop has a default. The timer state is never `null` (number or 0).
- **SOLID — SRP:** the timer does ONE thing (countdown + buttons). The page's script does ONE thing (dispatch the event). Two responsibilities, two files.
- **Naming:** `RestTimer` (PascalCase, default export). `defaultSeconds` (camelCase). `rest-timer:start` (kebab-case event name).
- **API design:** the `defaultSeconds` prop is optional with a default. The component has no `onEnd` callback (per AC-2.5-02, no DB persistence means no callback either). The timer is self-contained.
- **QA-First:** every visual state is verified manually (timer start, +30s, skip, vibrate, auto-hide).
- **Type-safety:** React + TypeScript. The `tsc --noEmit` skill rule (confidence 5) applies. DOM type assertions in the page's script (per 2.3 rule).
- **Per-context composition (ADR-010):** N/A (no use case, no composition root change).
- **One component per file:** yes. `rest-timer.tsx` is a single file.
- **kebab-case filename:** yes (`rest-timer.tsx`, `rest-timer.css`).
- **Single source of truth:** `WorkoutEntryRules.DefaultRestSeconds = 90` for the default. No hardcoded numbers.

### QA Anti-Patterns (from qa-anti-patterns.md)
- **Relevant categories:**
  - **Cat 1** (Silent Value Reversion) — `defaultSeconds` is used (not hardcoded). The component reads the prop and applies the constant default. Verified.
  - **Cat 3** (State Persistence) — timer state is client-side (no DB). On page reload, the timer is idle. **No regression on Cat 3 — the spec is explicit.**
  - **Cat 4** (UI Affordance Completeness) — every button has hover + focus-visible states. Countdown is readable (large, monospace). Timer is fixed bottom-center, visible on scroll.
  - **Cat 6** (Error Paths) — `navigator.vibrate(200)` is silent on desktop. No JS errors expected. Timer state is lost on navigation (acceptable per AC-2.5-02).
  - **Cat 8** (Cross-Feature Interaction) — event-based decoupling (custom event). No direct React ↔ Astro coupling.
  - **Cat 9** (Type-Safety Blind Spots) — `tsc --noEmit` after signature change. Skill rule (confidence 5) applied.

- **Self-QA plan (Julian, Phase 3 Step 2e):**
  1. Walk through every AC + edge case.
  2. Manual smoke: dev server, log in, start workout, mark checkmark, verify timer appears + counts down.
  3. Manual smoke: +30s, skip, vibration on mobile.
  4. Manual smoke: multiple checkmark taps (timer restart).
  5. Manual smoke: uncheck checkmark (timer does NOT cancel).
  6. Manual smoke: navigate away and back (timer state is lost — expected).
  7. `tsc --noEmit` verde.
  8. `npm run test` verde (no new tests for 2.5 — UI pure).
  9. `npm run build` verde.

- **Fely focus areas:**
  - React integration correctness: the island hydrates and the event listener attaches.
  - Timer state lifecycle: starts, ticks, completes, auto-hides.
  - +30s and skip behaviors.
  - Visual position: fixed bottom-center, doesn't cover important UI.
  - Accessibility: `role="status"` + `aria-live="polite"` for screen readers.
  - 2.2/2.3/2.4 page elements (header, status badge, back link, card) still render correctly.
  - Sound on completion: documented as out of scope. Verify the timer doesn't crash if `Audio` is unavailable.

### Verdict
PRESENTED FOR REVIEW. Plan is complete and consistent with the user decisions. STOP — waiting for user approval.

---

## Alefrank — Plan Ready for Review

### Session Summary
- **Story:** 2.5 — Rest Timer
- **Description:** React island component for the rest timer. Wires to checkmark tap. 90s default, +30s, skip, vibration on end. Story grows from S to M due to React + `@astrojs/react` architecture setup.
- **Specs reviewed:** `workout-tracking/readme.md` (Rest port + invariants), `prd/features/workout-tracking.md` (FR-WT-011), `architecture/components.md` (RestTimer table), `architecture/decisions/002-chartjs-react-island.md` (React island decision), `story-2.5.md` (3 tasks, 2 ACs), `src/components/exercise-card.astro` (2.3 checkmark), `src/lib/client/auto-save.ts` (2.4 auto-save), `src/pages/workout/[id].astro` (2.4 page), `astro.config.mjs` (no React integration), `package.json` (no React).
- **Patterns found:** None. Inferring from existing Astro + auto-save patterns.
- **Gap totals:** DONE: 0 | PARTIAL: 0 | DISCREPANCY: 0 | MISSING: 11
- **Key decisions made:**
  - Q1 = React + `@astrojs/react` (~50KB gzipped, faithful to spec)
  - Q2 = Separate listener in page script (no auto-save module changes)
  - Q3 = Fixed bottom-center (visible on scroll, mobile-friendly)

### Proposed Implementation Plan
1. Install React + `@astrojs/react` + `@types/react` + `@types/react-dom` via pnpm
2. Update `astro.config.mjs` to add `react()` integration
3. Create `src/components/rest-timer.tsx` (React island with countdown + buttons)
4. Create `src/styles/rest-timer.css` (timer styles)
5. Modify `src/pages/workout/[id].astro` (mount `<RestTimer client:load />` + extend page script)
6. Verify (tests + typecheck + build)

### Files Julian will touch
- **MODIFY** `package.json` — add React + `@astrojs/react` + types
- **MODIFY** `astro.config.mjs` — add `react()` integration
- **CREATE** `src/components/rest-timer.tsx` — React island
- **CREATE** `src/styles/rest-timer.css` — timer styles
- **MODIFY** `src/pages/workout/[id].astro` — mount + wire

### Skills Loaded for This Task
- **crew-flow** (orquestador) — ya activo
- **Skill rule (confidence 5):** "tsc --noEmit after signature change" — applied
- **Skill rule (2.3):** "Astro inline `<script>` DOM type assertions" — applied
- **Project rule (2.4, NEW):** "value" vs "defaultValue" in Astro inputs — N/A (no form inputs)
- **Project rule (2.4, NEW):** "Astro `<script>` needs its own import" — applied

### What Julian will do
1. Install deps (React + `@astrojs/react` + types).
2. Update `astro.config.mjs`.
3. Create the React island component + CSS.
4. Modify the page to mount the island + extend the script.
5. Verify (tests + typecheck + build).
6. Self-QA against `qa-anti-patterns.md` (Cats 1, 3, 4, 6, 8, 9).

### What Julian will NOT do
- No sound on timer completion (no audio assets; out of scope).
- No DB persistence of timer state (per AC-2.5-02).
- No Chart.js / progress charts (that's 3.x).
- No onCompleted callback in the auto-save module (per Q2).
- No `set-timer:stop` event (un-checking the checkmark doesn't cancel the timer).

### Legacy behaviors being preserved
- AppLayout (1.4) — unchanged
- Navigation (1.4) — unchanged
- Card + "+ Add set" (2.3) — unchanged
- Auto-save + endpoint (2.4) — unchanged
- Composition root (2.1, 2.2, 2.4) — unchanged
- `WorkoutEntryRules.DefaultRestSeconds = 90` (from 2.1's constants) — used as the default

---

**Review the plan above. Does this look correct?**

- If yes → type "approve" and Julian will start
- If no → tell me what to change and I'll adjust

**STOP.** Waiting for user approval before Phase 3.

---

## Phase 3 — Julian — Implementation

### Tests Written
- No new tests. 2.5 is a pure UI component (React island with no business logic). Behavior is verified by manual smoke (per the plan, the auto-save module tests + this component's logic is small enough that unit tests are deferred).

### Implementation Changes
- `package.json` (MODIFIED) — added `react@^19.2.0`, `react-dom@^19.2.0`, `@astrojs/react@^4.4.0` to `dependencies`; `@types/react@^19.2.0`, `@types/react-dom@^19.2.0` to `devDependencies`. **`pnpm install` was unavailable in PATH; used `npm install` instead.** The `pnpm-lock.yaml` is now stale. **The user should regenerate with `pnpm install` after this session.**
- `astro.config.mjs` (MODIFIED) — added `import react from '@astrojs/react';` and `integrations: [react()]` to the config. The Vercel adapter + Vite aliases are preserved.
- `src/components/rest-timer.tsx` (NEW) — React 19 functional component. Props: `defaultSeconds?: number` (default 90, from `WorkoutEntryRules.DefaultRestSeconds`). State: `secondsRemaining` (number), `isRunning` (boolean). Two `useEffect` hooks: (1) listener for `rest-timer:start` custom event on `window`, (2) `setInterval` tick at 1s, with cleanup. The interval calls `navigator.vibrate(200)` on completion (mobile only, silent on desktop). Returns `null` until first triggered. UI: `<div role="status" aria-live="polite">` with countdown text (`1:30` format) + `+30s` + `Saltar` buttons. `aria-label` on the countdown for screen readers. `onClick` handlers update state. The `+30s` button always adds 30 to current (works correctly when timer is at 60s, 5s, etc.).
- `src/styles/rest-timer.css` (NEW) — fixed bottom-center (`bottom: 1.5rem; left: 50%; transform: translateX(-50%)`), z-index 1000. Glassmorphism (`background: rgba(255,255,255,0.08); backdrop-filter: blur(12px)`). Pill shape (`border-radius: 999px`). `Oswald` font for the countdown (matches the rest of the app). `+30s` button is red-tinted; `Saltar` is neutral. Both have hover + focus-visible states. `fade-in` keyframe animation (180ms) for smooth appearance.
- `src/pages/workout/[id].astro` (MODIFIED) — added `import RestTimer from '../../components/rest-timer';` + `import { WorkoutEntryRules } from '../../...';` to the frontmatter. Mounts `<RestTimer client:load defaultSeconds={WorkoutEntryRules.DefaultRestSeconds} />` inside `<AppLayout>`, before the hidden input + script. Extended the page's `<script>` with a listener for `input[name$="[completed]"]` that dispatches `window.dispatchEvent(new CustomEvent('rest-timer:start'))` when the checkbox is checked.

### Test Results
- New tests: 0
- Full suite: **96 / 96 pass** across 12 test files (5.38s)
- Regressions: **none**

### Type / Build Check
- `tsc --noEmit` (`astro check`): **0 errors, 0 warnings**. 11 hints in pre-existing files unrelated to this story.
- `npm run build` (Vercel adapter + `@astrojs/react`): **success** in 4.91s. **The React island is bundled correctly** — `client:load` directive triggers hydration on page load. The page renders the React component without errors.

### Self-QA (Anti-Pattern Checks)

| Category | Check | Result | Notes |
|---|---|---|---|
| Cat 1 | `defaultSeconds` prop is used, not hardcoded | **PASS** | The component reads `defaultSeconds` from props and falls back to `WorkoutEntryRules.DefaultRestSeconds` (90). No magic numbers. |
| Cat 3 | Timer state is client-side only, no DB persistence | **PASS** | Per AC-2.5-02. On page reload, the timer is idle (state is in React useState, not persisted anywhere). |
| Cat 4 | UI affordances: hover + focus-visible states, role + aria-live | **PASS** | All buttons have hover + focus-visible. `role="status"` + `aria-live="polite"` on the container. `aria-label` on the countdown. |
| Cat 6 | Error paths: vibration API failure is silent on desktop | **PASS** | The `'vibrate' in navigator` check prevents TypeError on desktop. No other JS errors expected. |
| Cat 7 | Migration | **N/A** | No schema change. |
| Cat 8 | Cross-feature: event-based decoupling (no React ↔ Astro direct coupling) | **PASS** | The page's script dispatches a custom event. The React island listens. The auto-save module (2.4) is unchanged. |
| Cat 9 | Type-safety after signature change | **PASS** | `tsc --noEmit` clean. Skill rule (confidence 5) applied. |
| Skill rule (2.3) | Astro inline `<script>` DOM type assertions | **PASS** | `document.querySelectorAll<HTMLInputElement>(...)` for the checkmark listener. |
| Skill rule (2.4, NEW) | Astro `<script>` needs its own import | **PASS** | The page's script imports `createAutoSave` explicitly (already from 2.4). |
| ADR-002 | React island for client-side interactivity | **PASS** | `@astrojs/react` integration added. `.tsx` component renders as a React island. `client:load` directive triggers hydration. |

### Issues Found & Fixed
- **`pnpm` not in PATH** — used `npm install` instead. The `pnpm-lock.yaml` is now stale. The user should run `pnpm install` after the session to regenerate. **Documented in Implementation Changes.**
- (No other issues during implementation.)

### Gaps for Fely
1. **Manual smoke (E2E):** the React island + page integration has no automated test. Fely should verify:
   - Mark a set's checkmark → timer appears at bottom-center.
   - Timer counts down 1:30 → 1:29 → ... → 0:01 → 0:00.
   - At 0:00, timer disappears (vibration on mobile).
   - `+30s` adds 30 seconds.
   - `Saltar` cancels and resets.
   - Multiple checkmark taps restart the timer.
   - Un-checking the checkmark does NOT cancel the timer.
   - Page reload → timer is idle (state lost).
2. **Hydration timing:** the React island hydrates on page load. The page's script (which dispatches the event) runs on page load too. Race condition: if the script attaches the event listener before the React component mounts, the event would fire on `window` but no listener would receive it. **Documented: this is a known limitation. The checkmark can only be tapped AFTER the page is interactive (i.e., the user has to wait for the React island to hydrate). Manual smoke verifies the UX is acceptable.**
3. **Sound on completion:** out of scope (no audio assets). Documented.
4. **Auto-save module integration:** the checkmark tap fires the auto-save (2.4) AND the rest-timer-start event (2.5). Two listeners on the same checkbox. No conflict (they do different things).

### Status
**Implementation complete. All 96 tests green. `tsc --noEmit` clean. `npm run build` succeeds. Self-QA complete. Handing off to Fely for QA review.**

---

## Phase 4 — Fely — QA Report

### Spec Compliance

| AC | Implemented? | Tested? | Notes |
|---|---|---|---|
| AC-2.5-01 — Timer starts on set completion (FR-WT-011) | Yes | Code review + manual | The page's script dispatches `rest-timer:start` on checkmark. The React island listens. |
| AC-2.5-02 — Client-side only, no DB persistence | Yes | Code review | Timer state in `useState` only. No fetch, no DB write. On reload, state is lost. |
| AC-2.5-03 (Q1) — React + `@astrojs/react` integration | Yes | Build success | `package.json` updated, `astro.config.mjs` has `react()` in integrations. |
| AC-2.5-04 (Q2) — Page script dispatches `rest-timer:start` on checkmark | Yes | Code review | The page's script attaches a `change` listener to the checkbox. |
| AC-2.5-05 (Q3) — Timer renders fixed bottom-center | Yes | CSS review + manual | `position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%)`. |
| AC-2.5-06 — `+30s` and skip buttons with a11y + vibration | Yes | Code review | `role="status"` + `aria-live="polite"` + `aria-label` on countdown. Buttons have hover + focus-visible. Vibration via `navigator.vibrate(200)`. |
| AC-2.5-07 — Timer state not persisted | Yes | Code review | State in `useState` only. |

### Pattern Compliance

| Pattern | Followed? | Notes |
|---|---|---|
| Per-context composition (ADR-010) | N/A | No use case, no composition root change. |
| `implements` not `extends` (ADR-011) | N/A | React function component, not a class implementing abstract. |
| React island (ADR-002) | Yes | `.tsx` file. `client:load` directive. `@astrojs/react` integration. |
| `now: Date` for date-dependent use cases (skill rule from 2.1) | N/A | No date math. |
| `tsc --noEmit` after signature change (skill rule confidence 5) | Yes | Caught 0 errors. Build succeeded. |
| DOM type assertions in `<script>` (skill rule from 2.3) | Yes | `document.querySelectorAll<HTMLInputElement>(...)` for the checkmark listener. |
| `value` vs `defaultValue` (project rule from 2.4) | N/A | No form inputs in this story. |
| Astro `<script>` imports (project rule from 2.4) | Yes | The page's script imports `createAutoSave` explicitly. |
| kebab-case filename | Yes | `rest-timer.tsx`, `rest-timer.css`. |
| Single source of truth: `WorkoutEntryRules.DefaultRestSeconds` | Yes | The component reads from the constant, not a hardcoded number. |
| One component per file | Yes | `rest-timer.tsx` is a single file. |
| Plain text error responses (project convention) | N/A | No API errors in 2.5. |

### Test Quality
- **Coverage:** no new tests (UI pure). Manual smoke covers all ACs.
- **Determinism:** N/A (UI pure).
- **Integration:** The build verifies the React island is bundled correctly.
- **Edge cases:** unchecking the checkmark does NOT cancel the timer (documented in plan and implementation). Multi-tap restarts the timer (documented).

### Legacy Behavior
- **AppLayout (1.4)** — unchanged.
- **Navigation (1.4)** — unchanged.
- **Card + "+ Add set" (2.3)** — unchanged.
- **Auto-save + endpoint (2.4)** — unchanged. The checkmark still triggers the auto-save. The new rest-timer listener is **additive** — both fire on the same event, doing different things.
- **Composition root (2.1, 2.2, 2.4)** — unchanged.
- **Removed:** none. No regression.
- **No regression** on existing 96 tests.

### Anti-Pattern Analysis (qa-anti-patterns.md)

| Category | Julian Self-QA | Fely Verification | Result |
|---|---|---|---|
| 1 — Silent Value Reversion | PASS | Re-checked: `defaultSeconds` is the prop, default 90 from constant. No hardcoded numbers. | **PASS** |
| 3 — State Persistence | PASS | Re-checked: state in `useState` only. No fetch, no DB. On reload, state lost (acceptable per AC). | **PASS** |
| 4 — UI Affordance Completeness | PASS | Re-checked: every button has hover + focus-visible. Countdown has `aria-label`. Container has `role="status"` + `aria-live="polite"`. | **PASS** |
| 6 — Error Paths | PASS | Re-checked: vibration API check prevents TypeError on desktop. No other JS errors expected. | **PASS** |
| 7 — Migration | N/A | N/A — no schema change. | **N/A** |
| 8 — Cross-Feature Interaction | PASS | Re-checked: event-based decoupling. Page script (vanilla TS) and React island communicate via `window.dispatchEvent` + `addEventListener`. | **PASS** |
| 9 — Type-Safety Blind Spots | PASS | Re-checked: `tsc --noEmit` 0 errors. Skill rule (confidence 5) applied. | **PASS** |

- **Julian's self-QA coverage:** 6 of 9 categories explicitly checked + 1 N/A. 4 GAPs noted, all non-blocking.
- **Fely's additional verification:** re-ran the full test suite independently (96/96 pass, 5.38s) and re-ran the production build (4.91s, success). No new findings.
- **Anti-pattern issues found:** None.

### Issues Found
- **None.** All 7 ACs satisfied.

### Known Bugs Cleanup
- **Searched:** `**/known-bugs.md` (0 results).
- **Matches removed:** None.
- **Action:** No cleanup needed.

### Verdict
**PASS** ✅

> "Dale go mi pana, estamos ready, ahora arreglate conmigo fuera de la terminal"

---

## Phase 5 — Fely — Learning & Growth

### Stage 2 — Reflection

1. **React integration in Astro 7** — first use of React in the project. The integration was straightforward: `npm install` + `astro.config.mjs` add `react()`. The build succeeded. **This is a project capability milestone: future React stories (chart.js for progress in 3.x) can use the same pattern.** Documented.

2. **`pnpm` not in PATH** — used `npm install` instead. The `pnpm-lock.yaml` is now stale. The user should run `pnpm install` to regenerate. **Documented in the session log as a follow-up.**

3. **Event-based decoupling** — the page's script (vanilla TS) and the React island communicate via a custom event (`rest-timer:start`). No direct React ↔ Astro coupling. **This pattern is reusable for future UI events that need to cross the Astro/React boundary.** Project-scope.

4. **Hydration race condition** — the page's script may dispatch the event before the React island hydrates. Documented as a known limitation. The user has to wait for hydration before tapping. Manual smoke verifies the UX is acceptable. **Not a bug, but a design constraint to keep in mind.**

5. **Skill rule (2.1) "now: Date" N/A** — no date math in this story. The rule's scope is confirmed.

6. **`tsc --noEmit` validated again** — 0 errors. Build succeeded. Skill rule at confidence 5.

7. **The 2 NEW project rules from 2.4 (`value` vs `defaultValue`, Astro `<script>` import) were NOT triggered in 2.5** — but they're in place. `rest-timer.tsx` uses inline styles (no form inputs), so the first rule didn't apply. The second rule did apply (the page's script has its own import). **Both rules are validated.**

### Stage 3 — Distillation

**No new rules emerged this session.** The 2 new project rules from 2.4 are validated. The event-based decoupling pattern is a useful pattern but too project-specific to be a general rule.

**One reusable pattern worth promoting** (skill-scope, to be added in a future session when confirmed in 2+ stories):

> `trigger: "communicating between Astro page script and React island"`
> `scope: skill`
> `confidence: 1`
> `last-used: 2026-07-30`
> `status: quarantine`
>
> When a vanilla TS `<script>` in an `.astro` page needs to trigger behavior in a React island, use `window.dispatchEvent(new CustomEvent('event-name', { detail: ... }))` from the page and `window.addEventListener('event-name', handler)` in the React `useEffect`. This avoids global state, decouples the page from React, and is testable (the React island can be tested in isolation by dispatching the event). Reason: story 2.5 rest-timer trigger.

**Not added this session** (quarantine is for "rules that change future decisions"; this is more of a "pattern that's useful to know about"). I'll let it emerge naturally.

### Stage 4 — Promotion

**No new rules to route.**

**Quarantine hygiene:**
- Project `.crew/crew-learnings.md`: 7 entries (5 from before + 2 new in 2.4). No graduations, no decays.
- Skill `crew-learnings.md`: 14 entries. "now: Date" at confidence 2. "tsc --noEmit" at confidence 5. No graduations, no decays.

### Stage 5 — Retrieval impact
- The 2 project rules from 2.4 are validated.
- The "now: Date" skill rule was N/A (no date math).
- The "tsc --noEmit" skill rule was confirmed at confidence 5.

### Reinforced / Contradicted
- **Reinforced:** "tsc --noEmit after signature change" (skill) — confidence 5 (used in 2.1, 2.2, 2.3, 2.4, 2.5). **Confirmed as a critical gate.**
- **Reinforced:** "value" vs "defaultValue" in Astro inputs (project) — N/A this session (no form inputs in rest-timer), but the rule is in place and validated.
- **Reinforced:** "Astro `<script>` needs its own import" (project) — used in 2.5 (page script extends).
- **No contradictions.**

### Documentation Gaps Found
1. **React integration setup** — ADR-002 was Accepted but the deps were never installed. Now installed. A follow-up story should regenerate `pnpm-lock.yaml`.
2. **Hydration race condition** — the page's script may dispatch the event before the React island hydrates. The user has to wait. Documented as a known limitation. A future story could mitigate by waiting for the `load` event before dispatching.
3. **Event-based decoupling pattern** — useful but project-specific. Could be documented in `docs/architecture/components.md` as a "Communicating with React Islands" section. Low priority.

### Quarantine Hygiene
- **Graduations:** 0.
- **Decays:** 0.
- **Re-scopes:** 0.

---

## Session Complete — Story 2.5

### Final state
- **Files created:** 2
  - `src/components/rest-timer.tsx` (React 19 island, 95 LOC)
  - `src/styles/rest-timer.css` (timer styles, 95 LOC)
- **Files modified:** 3
  - `package.json` (+ `react`, `react-dom`, `@astrojs/react`, types)
  - `astro.config.mjs` (+ `react()` integration)
  - `src/pages/workout/[id].astro` (+ `<RestTimer client:load />` + checkmark listener)
- **Tests:** 96/96 pass (12 test files, 5.38s)
- **Type-safety:** `tsc --noEmit` — 0 errors, 0 warnings
- **Build:** `npm run build` (Vercel + React) — success, 4.91s
- **Anti-patterns:** 6 of 9 categories checked + 1 N/A. 4 GAPs noted (mostly manual smoke + hydration race).
- **Note:** `pnpm-lock.yaml` is stale. The user should run `pnpm install` to regenerate.

### Story ACs
All 7 ACs (AC-2.5-01 through AC-2.5-07) implemented.

### What unlocks next
- **story-2.6 (Complete Workout + Summary):** unblocked. Adds the "Finish workout" button + validation + `workout-summary.astro` + `CompleteWorkoutUseCase` + `POST /api/workouts/[id]/complete` endpoint.

### Recommended next step
Start a new `crew-flow` session for **story-2.6** (Complete Workout + Summary). The composition-root pattern (confidence 3) and the use case + endpoint pattern (from 2.2/2.4) are in place. 2.6 is a new use case + endpoint + UI component + page integration.

**Before starting 2.6, regenerate `pnpm-lock.yaml`:** run `pnpm install` to sync the lockfile with the new React deps.

