# Body Metrics Context

Parent: [../readme.md](../readme.md) · PRD: [body-metrics.md](../../../prd/features/body-metrics.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Decisions | [ADR-023](../../decisions/023-body-metrics-privacy.md), [ADR-006](../../decisions/006-kg-storage.md), [ADR-004](../../decisions/004-rls-visibility.md) (exception list) |
| Schema | [008 — Body metrics](../../database-schema.md#008--body-metrics-adr-023) |
| Stories | [11.1](../../../stories/phase-2/round-11/story-11.1.md) (log, list, charts, port), [11.3](../../../stories/phase-2/round-11/story-11.3.md) (consumes `findNearest`), [12.4](../../../stories/phase-2/round-12/story-12.4.md) (CSV) |

## Purpose

Hevy-style log of body weight, body fat and body measurements, with charts and a "latest values" card. Requirements: [FR-BM-001 … FR-BM-009](../../../prd/features/body-metrics.md).

**Owner-only for every operation** ([ADR-023](../../decisions/023-body-metrics-privacy.md)). Body metrics never appear in public view, the feed, member cards, share images, or another user's export. Other contexts read the owner's own body weight only through `BodyWeightPort`.

| Owns | Reads | Provides |
|---|---|---|
| `body_measurements` | `profiles.weight_unit`, `profiles.timezone` (display + "today") | `BodyWeightPort` → progress (bodyweight volume FR-BM-007 / FR-PR-014, weekly facts ADR-026), private-photos (FR-PP-009) |

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/body-metrics/domain/`.

| File | Content |
|---|---|
| `body-metrics.types.ts` | Types below |
| `body-metrics.constants.ts` | `BodyMetricKeys`, `BodyMetricRules`, `MetricLabels`, `MeasurementRanges`, `UnitFactors` |
| `body-metric-rules.ts` | `validateMeasurement`, `mergeMeasurement`, `hasAnyValue` (pure) |
| `body-metric-units.ts` | `toStored`, `toDisplay`, `kgToLb`, `lbToKg`, `cmToIn`, `inToCm`, `unitOf` (pure) |
| `measurement-series.ts` | `movingAverage`, `buildSeries`, `latestWithDelta`, `bodyWeightOn`, `nearestWeight` (pure) |
| `body-measurement.repository.ts` | `BodyMeasurementRepository` (abstract) |
| `ports/body-weight.port.ts` | `BodyWeightPort` (abstract, **provided**) |
| `errors.ts` | `EmptyMeasurementError`, `MeasurementOutOfRangeError`, `FutureMeasurementDateError`, `NotesTooLongError`, `BodyMeasurementNotFoundError`, `MeasurementDateTakenError` |

### `body-metrics.types.ts`

```ts
// src/lib/contexts/body-metrics/domain/body-metrics.types.ts
import type { BodyMeasurement, Profile } from '@db/schema';
import type { BodyMetricKey, MeasurementRange } from './body-metrics.constants';

export type WeightUnit = Profile['weightUnit'];          // 'kg' | 'lbs' → display kg+cm or lb+in

/** Metric values keyed by Drizzle field name. Stored units: kg, %, cm. */
export type MeasurementValues = Partial<Record<BodyMetricKey, number | null>>;

export interface LogMeasurementInput {
  userId: string;
  measuredOn?: string;          // 'YYYY-MM-DD' local date; default today in profiles.timezone
  values: MeasurementValues;    // DISPLAY units (kg|lb, %, cm|in); empty → null
  notes?: string | null;
}

export interface UpdateMeasurementInput extends LogMeasurementInput {
  id: string;
}

export interface MeasurementListItem {
  id: string;
  measuredOn: string;           // 'YYYY-MM-DD'
  values: MeasurementValues;    // stored units, only non-null keys
  notes: string | null;
}

export interface SeriesPoint {
  date: string;                 // 'YYYY-MM-DD'
  value: number;                // stored unit
  movingAverage: number | null; // weightKg only (FR-BM-005)
}

export interface LatestMetric {
  key: 'weightKg' | 'bodyFatPct';
  value: number;                // stored unit
  measuredOn: string;
  delta: number | null;         // value − compared value
  comparedOn: string | null;    // closest entry ≥ 30 days earlier
  deltaDays: number | null;
}

export interface BodyWeightPoint {
  measuredOn: Date;             // DATE (UTC midnight of the local date)
  weightKg: number;
}

export type { BodyMeasurement, BodyMetricKey, MeasurementRange };
```

### `body-metrics.constants.ts`

```ts
// src/lib/contexts/body-metrics/domain/body-metrics.constants.ts

/** Drizzle field name ↔ column (FR-BM-001). Order = form order = CSV order. */
export const BodyMetricKeys = {
  weightKg: 'weight_kg',
  bodyFatPct: 'body_fat_pct',
  neckCm: 'neck_cm',
  shouldersCm: 'shoulders_cm',
  chestCm: 'chest_cm',
  leftBicepCm: 'left_bicep_cm',
  rightBicepCm: 'right_bicep_cm',
  leftForearmCm: 'left_forearm_cm',
  rightForearmCm: 'right_forearm_cm',
  abdomenCm: 'abdomen_cm',
  waistCm: 'waist_cm',
  hipsCm: 'hips_cm',
  leftThighCm: 'left_thigh_cm',
  rightThighCm: 'right_thigh_cm',
  leftCalfCm: 'left_calf_cm',
  rightCalfCm: 'right_calf_cm',
} as const;
export type BodyMetricKey = keyof typeof BodyMetricKeys;

/** Ranges in STORED units (FR-BM-001). Lengths are validated here, not as DB CHECKs (schema 008 note). */
export const BodyMetricRules = {
  Ranges: {
    weightKg: { min: 20, max: 400 },
    bodyFatPct: { min: 2, max: 70 },
    neckCm: { min: 10, max: 100 },
    shouldersCm: { min: 50, max: 250 },
    chestCm: { min: 50, max: 250 },
    leftBicepCm: { min: 10, max: 80 },
    rightBicepCm: { min: 10, max: 80 },
    leftForearmCm: { min: 10, max: 60 },
    rightForearmCm: { min: 10, max: 60 },
    abdomenCm: { min: 40, max: 250 },
    waistCm: { min: 40, max: 250 },
    hipsCm: { min: 50, max: 250 },
    leftThighCm: { min: 20, max: 120 },
    rightThighCm: { min: 20, max: 120 },
    leftCalfCm: { min: 15, max: 80 },
    rightCalfCm: { min: 15, max: 80 },
  },
  MaxNotesLength: 300,
  StoredDecimals: 2,            // values are stored rounded to 0.01 after conversion
  DisplayDecimals: 1,           // FR-BM-004
  MovingAverageEntries: 7,      // FR-BM-005
  DeltaMinDays: 30,             // FR-BM-006
  PhotoMatchToleranceDays: 3,   // FR-PP-009
  PageSize: 20,
} as const;

/** Chart ranges (FR-BM-005): 30 d / 3 m / 1 a / todo. */
export const MeasurementRanges = {
  Days30: '30d',
  Months3: '3m',
  Year1: '1y',
  All: 'all',
} as const;
export type MeasurementRange = (typeof MeasurementRanges)[keyof typeof MeasurementRanges];

/** UI copy (es), FR-BM-001. */
export const MetricLabels = {
  weightKg: 'Peso corporal', bodyFatPct: 'Grasa corporal', neckCm: 'Cuello', shouldersCm: 'Hombros',
  chestCm: 'Pecho', leftBicepCm: 'Bíceps izq', rightBicepCm: 'Bíceps der',
  leftForearmCm: 'Antebrazo izq', rightForearmCm: 'Antebrazo der', abdomenCm: 'Abdomen',
  waistCm: 'Cintura', hipsCm: 'Cadera', leftThighCm: 'Muslo izq', rightThighCm: 'Muslo der',
  leftCalfCm: 'Gemelo izq', rightCalfCm: 'Gemelo der',
} as const;

/** Same factor as LogSetUseCase (LBS_TO_KG). */
export const UnitFactors = { LbToKg: 0.453592, InToCm: 2.54 } as const;
```

### Pure functions

```ts
// body-metric-units.ts
unitOf(key): 'mass' | 'percent' | 'length'           // weightKg → mass, bodyFatPct → percent, *Cm → length
toStored(key, displayValue, unit: WeightUnit): number
  mass   → unit = 'lbs' ? round(v × 0.453592, 2) : round(v, 2)
  length → unit = 'lbs' ? round(v × 2.54, 2)     : round(v, 2)     // lbs users enter inches
  percent → round(v, 2)
toDisplay(key, storedValue, unit): number             // inverse, rounded to 1 decimal (FR-BM-004)
kgToLb(kg) = kg / 0.453592 ; lbToKg(lb) = lb × 0.453592 ; cmToIn(cm) = cm / 2.54 ; inToCm(inch) = inch × 2.54

// body-metric-rules.ts
hasAnyValue(values): boolean                          // ≥ 1 key with a non-null number
validateMeasurement(values (stored), notes, measuredOn, todayKey): void
  !hasAnyValue(values)                    → EmptyMeasurementError       ("Registra al menos una medida")
  value ∉ BodyMetricRules.Ranges[key]     → MeasurementOutOfRangeError(key, min, max)
  measuredOn > todayKey                   → FutureMeasurementDateError  ("La fecha no puede ser futura")
  notes.length > 300                      → NotesTooLongError
mergeMeasurement(existing: BodyMeasurement, incoming: MeasurementValues, notes): MeasurementValues & { notes }
  // FR-BM-002: for every key, incoming non-null overwrites; null/empty keeps existing. Non-empty notes overwrite.

// measurement-series.ts
movingAverage(values: number[], window = 7): (number | null)[]
  // trailing mean of up to `window` entries ending at i (fewer at the start)
buildSeries(rows: { measuredOn; value }[] /* ASC, full history */, key, range, today): SeriesPoint[]
  ma = key = 'weightKg' ? movingAverage(rows.map(value)) : nulls     // computed on the full history
  return rows filtered to measuredOn ≥ cutoff(range, today) with their ma
latestWithDelta(rows /* ASC, one metric */, key): LatestMetric | null
  latest   = last row
  compared = last row with measuredOn ≤ latest.measuredOn − 30 days       // closest entry ≥ 30 days earlier
  delta    = compared ? latest.value − compared.value : null
bodyWeightOn(points: BodyWeightPoint[] /* ASC */, date): number | null   // latest weight on or before date
nearestWeight(points, date, maxDays): BodyWeightPoint | undefined
  // min |measuredOn − date| in days, ≤ maxDays; tie → the earlier entry
```

Worked examples (`tests/body-metrics/*.test.ts`):

| Case | Input | Expected |
|---|---|---|
| lb input | `weightKg: 180` display, unit `lbs` | stored `81.65` |
| in input | `waistCm: 32` display, unit `lbs` | stored `81.28` |
| Display | stored `81.65`, unit `lbs` | `180.0` → "180 lb"; unit `kg` → "81.7 kg" |
| Merge | existing `{ weightKg: 80, waistCm: 85 }` + incoming `{ weightKg: 79.5, waistCm: null, chestCm: 100 }` | `{ weightKg: 79.5, waistCm: 85, chestCm: 100 }` |
| Empty | `{}` or all null | `EmptyMeasurementError` |
| Range | `bodyFatPct: 1.5` | `MeasurementOutOfRangeError('bodyFatPct', 2, 70)` |
| Moving average | weights `80, 81, 79, 80, 82, 81, 80, 78` | MA `80, 80.5, 80, 80, 80.4, 80.5, 80.43, 80.14` |
| Delta | latest 2026-10-01 78.2 kg; entries 2026-09-05 79.0, 2026-08-28 80.0 | compared 2026-08-28 (34 days), delta −1.8 → "−1.8 kg en 34 días" |
| bodyWeightOn | points 09-01 80, 09-10 79; date 09-09 | 80; date 08-31 → null |
| nearestWeight ±3 | points 09-01, 09-06; photo 09-04 | 09-06 (2 days); photo 09-10 → undefined |

> Decision: the moving average starts at the first entry with the mean of the available entries (fewer than 7) instead of leaving a gap (simplest; Hevy draws the line from the first point).
>
> Decision: the Δ copy uses the real day gap ("en 34 días"), since the compared entry is the closest one at least 30 days earlier.
>
> Decision: values are stored rounded to 0.01 after unit conversion; display rounds to 0.1 (FR-BM-004).

### Entities

- `BodyMeasurement` — Drizzle row of `body_measurements`. Identity `id`; natural key `(userId, measuredOn)` (one entry per user per date, FR-BM-002). Owner-only.

### Value Objects

- `MeasurementValues`, `SeriesPoint`, `LatestMetric`, `BodyWeightPoint`, `MeasurementRange`.

### Invariants

- **Owner-only**: every repository method takes `userId` and filters `where user_id = ?`; RLS `body_measurements_{select,insert,update,delete}_own` in Supabase. A foreign id behaves as not found (404), never 403, so existence does not leak.
- One entry per `(user_id, measured_on)`. Logging on an existing date **merges** (FR-BM-002); editing replaces exactly the submitted fields (an emptied field becomes null).
- At least one metric value per entry; every value inside `BodyMetricRules.Ranges` (stored units); `measured_on ≤ today` in `profiles.timezone`; notes ≤ 300 characters.
- Storage kg / % / cm; display follows `weight_unit` (kg → kg + cm, lbs → lb + in) with 1 decimal ([ADR-006](../../decisions/006-kg-storage.md)).
- `BodyWeightPort` never takes a second user id: callers pass the session user's id only. Body metrics never reach feed, share image, public profile or anyone else's export (FR-BM-009).

### Ports

| Port | File | Kind | Implemented by |
|---|---|---|---|
| `BodyMeasurementRepository` | `domain/body-measurement.repository.ts` | required | `SqliteBodyMeasurementRepository`, `SupabaseBodyMeasurementRepository` |
| `MeasurementProfilePort` | `domain/ports/measurement-profile.port.ts` | required | `SqliteMeasurementProfileAdapter`, `SupabaseMeasurementProfileAdapter` (`weight_unit`, `timezone` of `profiles`) |
| `BodyWeightPort` | `domain/ports/body-weight.port.ts` | **provided** → progress, private-photos | `BodyWeightService` (application) |

---

## Application

### Use Cases

Files `src/lib/contexts/body-metrics/application/<verb-noun>.use-case.ts`; `now?: Date` injectable.

| Use case | Purpose | Story | Status |
|---|---|---|---|
| `LogMeasurementUseCase` | Create the entry for a date, or merge into the existing one (FR-BM-001/002) | [11.1](../../../stories/phase-2/round-11/story-11.1.md) | planned |
| `UpdateMeasurementUseCase` | Edit an entry (replace fields, optional date change) (FR-BM-003) | 11.1 | planned |
| `DeleteMeasurementUseCase` | Delete an entry after UI confirmation (FR-BM-003) | 11.1 | planned |
| `ListMeasurementsUseCase` | Entries newest first, 20 per page, only fields with values (FR-BM-003) | 11.1 | planned |
| `GetMeasurementSeriesUseCase` | One metric over 30 d / 3 m / 1 a / todo, with the 7-entry moving average for body weight (FR-BM-005) | 11.1 | planned |
| `GetLatestMeasurementsUseCase` | Latest weight and body fat with Δ vs the closest entry ≥ 30 days earlier (FR-BM-006) | 11.1 | planned |
| `ExportMeasurementsCsvUseCase` | `gymup-measurements.csv`: `date` + every field in stored units (FR-BM-008) | [12.4](../../../stories/phase-2/round-12/story-12.4.md) | planned |

`BodyWeightService implements BodyWeightPort` (story 11.1; `findNearest` consumed by story 11.3) delegates to `BodyMeasurementRepository` and the pure helpers.

### Orchestration

1. **`LogMeasurementUseCase.execute(input, now)`**
   1. `profile = MeasurementProfilePort.findProfile(userId)` → `unit`, `timezone`; `todayKey = localDate(now, timezone)`; `measuredOn = input.measuredOn ?? todayKey`.
   2. `stored = toStored(...)` per non-empty key.
   3. `existing = repo.findByDate(userId, measuredOn)`.
   4. `values = existing ? mergeMeasurement(existing, stored, notes) : stored` → `validateMeasurement(values, notes, measuredOn, todayKey)`.
   5. `existing ? repo.update(existing.id, userId, values) : repo.create({ userId, measuredOn, ...values })`. Returns `{ measurement, merged: Boolean(existing) }`.
2. **`UpdateMeasurementUseCase.execute(input, now)`** → `repo.findById(id, userId)` (missing → `BodyMeasurementNotFoundError`); convert and validate the submitted fields as the full new state; if `measuredOn` changes and another entry exists on that date → `MeasurementDateTakenError`; `repo.update(...)`.
3. **`DeleteMeasurementUseCase.execute({ userId, id })`** → `repo.delete(id, userId)` (0 rows → `BodyMeasurementNotFoundError`).
4. **`ListMeasurementsUseCase.execute({ userId, page })`** → `repo.listByUser(userId, 20, (page − 1) × 20)` + `repo.countByUser(userId)` → `MeasurementListItem[]` with non-null keys only.
5. **`GetMeasurementSeriesUseCase.execute({ userId, key, range }, now)`** → `repo.listSeries(userId, key)` (full history, ASC) → `buildSeries(rows, key, range, today)`.
6. **`GetLatestMeasurementsUseCase.execute({ userId })`** → for `weightKg` and `bodyFatPct`: `repo.listSeries(userId, key)` → `latestWithDelta`.
7. **`ExportMeasurementsCsvUseCase.execute({ userId })`** → `repo.listAllByUser(userId)` ordered by `measured_on ASC` → CSV (RFC 4180 quoting, CRLF, UTF-8, header row): `date, weight_kg, body_fat_pct, neck_cm, shoulders_cm, chest_cm, left_bicep_cm, right_bicep_cm, left_forearm_cm, right_forearm_cm, abdomen_cm, waist_cm, hips_cm, left_thigh_cm, right_thigh_cm, left_calf_cm, right_calf_cm, notes`. `date` = `YYYY-MM-DD`; empty cell for null.
8. **`BodyWeightService`**
   - `getBodyWeightOn(userId, date)` → `repo.findLatestWeightOnOrBefore(userId, date)` → `weightKg | null`.
   - `findNearest(userId, date, maxDays)` → `repo.listWeightsBetween(userId, date − maxDays, date + maxDays)` → `nearestWeight(...)`.
   - `listBodyWeights(userId, until)` → `repo.listWeightsUntil(userId, until)` (batch lookups for stats; the caller uses `bodyWeightOn` per workout date).

> Decision: `notes` is part of the measurements CSV ("every field"); the export never includes other users (it is built from `userId` of the session only).

---

## Infrastructure

Per [ADR-007](../../decisions/007-repository-pattern.md), [ADR-011](../../decisions/011-implements-not-extends.md).

### Drizzle schema (`db/schema.ts`, story 11.1)

```ts
export const bodyMeasurements = sqliteTable('body_measurements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  measuredOn: integer('measured_on', { mode: 'timestamp_ms' }).notNull(),     // DATE
  weightKg: real('weight_kg'),
  bodyFatPct: real('body_fat_pct'),
  neckCm: real('neck_cm'),
  shouldersCm: real('shoulders_cm'),
  chestCm: real('chest_cm'),
  leftBicepCm: real('left_bicep_cm'),
  rightBicepCm: real('right_bicep_cm'),
  leftForearmCm: real('left_forearm_cm'),
  rightForearmCm: real('right_forearm_cm'),
  abdomenCm: real('abdomen_cm'),
  waistCm: real('waist_cm'),
  hipsCm: real('hips_cm'),
  leftThighCm: real('left_thigh_cm'),
  rightThighCm: real('right_thigh_cm'),
  leftCalfCm: real('left_calf_cm'),
  rightCalfCm: real('right_calf_cm'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex('uq_body_measurements_user_date').on(t.userId, t.measuredOn),
  index('idx_body_measurements_user').on(t.userId, t.measuredOn),
]);
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type NewBodyMeasurement = typeof bodyMeasurements.$inferInsert;
```

Migrations: `supabase/migrations/008_body_metrics.sql` + `db/migrations/0008_body_metrics.sql` ([database-schema.md → 008](../../database-schema.md#008--body-metrics-adr-023)).

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/body-metrics/domain/body-measurement.repository.ts
import type { BodyMeasurement, NewBodyMeasurement } from '@db/schema';

export type BodyMeasurementPatch = Partial<Omit<NewBodyMeasurement, 'id' | 'userId' | 'createdAt'>>;

/** Every method is owner-guarded: rows of other users are invisible (ADR-023). */
export abstract class BodyMeasurementRepository {
  abstract findById(id: string, userId: string): Promise<BodyMeasurement | undefined>;
  abstract findByDate(userId: string, measuredOn: Date): Promise<BodyMeasurement | undefined>;
  abstract listByUser(userId: string, limit: number, offset: number): Promise<BodyMeasurement[]>;   // measured_on DESC
  abstract countByUser(userId: string): Promise<number>;
  abstract listAllByUser(userId: string): Promise<BodyMeasurement[]>;                               // measured_on ASC (export)
  abstract listSeries(userId: string, key: BodyMetricKey): Promise<{ measuredOn: Date; value: number }[]>;  // key not null, ASC
  abstract findLatestWeightOnOrBefore(userId: string, date: Date): Promise<BodyWeightPoint | undefined>;
  abstract listWeightsBetween(userId: string, from: Date, to: Date): Promise<BodyWeightPoint[]>;
  abstract listWeightsUntil(userId: string, until: Date): Promise<BodyWeightPoint[]>;
  abstract create(input: NewBodyMeasurement): Promise<BodyMeasurement>;                // unique (user_id, measured_on)
  /** Throws BodyMeasurementNotFoundError when 0 rows match id + userId. */
  abstract update(id: string, userId: string, patch: BodyMeasurementPatch): Promise<BodyMeasurement>;
  abstract delete(id: string, userId: string): Promise<void>;
}

// src/lib/contexts/body-metrics/domain/ports/measurement-profile.port.ts
export abstract class MeasurementProfilePort {
  abstract findProfile(userId: string): Promise<{ weightUnit: WeightUnit; timezone: string } | undefined>;
}

// src/lib/contexts/body-metrics/domain/ports/body-weight.port.ts — PROVIDED (owner's own data only)
export abstract class BodyWeightPort {
  /** Latest body weight (kg) on or before `date` (FR-BM-007). null when none. */
  abstract getBodyWeightOn(userId: string, date: Date): Promise<number | null>;
  /** Closest weight entry within ±maxDays of `date` (weight_kg not null) (FR-PP-009 uses 3). Tie → earlier entry. */
  abstract findNearest(userId: string, date: Date, maxDays: number): Promise<BodyWeightPoint | undefined>;
  /** All weight entries up to `until`, ASC — batch input for stats (bodyWeightOn per workout). */
  abstract listBodyWeights(userId: string, until: Date): Promise<BodyWeightPoint[]>;
}
```

### SQLite Implementation (tests, E2E, local)

- `infrastructure/sqlite/sqlite-body-measurement.repository.ts` (`SqliteBodyMeasurementRepository`), `sqlite-measurement-profile.adapter.ts`.
- **Every query has `where user_id = ?`** ([ADR-023 Consequences](../../decisions/023-body-metrics-privacy.md)); `update`/`delete` use `where id = ? and user_id = ?` and check the affected row count.
- Unique violation on `create` (race with a concurrent log on the same date) → re-read with `findByDate` and merge (the use case retries once).

### Supabase Implementation (production)

- `infrastructure/supabase/supabase-body-measurement.repository.ts`, `supabase-measurement-profile.adapter.ts`.
- RLS `body_measurements_select_own`, `_insert_own`, `_update_own`, `_delete_own` (`auth.uid() = user_id`). The repository still adds `.eq('user_id', userId)` (defence in depth, same queries as SQLite).
- `create` maps Postgres `23505` (unique) to the same retry-merge path.

### Wiring (`body-metrics.composition.ts`)

```ts
// src/lib/contexts/body-metrics/body-metrics.composition.ts (excerpt; same resolveStorageBackend pattern as progress.composition.ts)
const backend = resolveStorageBackend();
const measurementRepository = buildBodyMeasurementRepository(backend);   // Sqlite… (db) | Supabase… (getSupabaseClient())
const profilePort = buildMeasurementProfile(backend);

export const logMeasurementUseCase = new LogMeasurementUseCase(measurementRepository, profilePort);
export const updateMeasurementUseCase = new UpdateMeasurementUseCase(measurementRepository, profilePort);
export const deleteMeasurementUseCase = new DeleteMeasurementUseCase(measurementRepository);
export const listMeasurementsUseCase = new ListMeasurementsUseCase(measurementRepository);
export const getMeasurementSeriesUseCase = new GetMeasurementSeriesUseCase(measurementRepository, profilePort);
export const getLatestMeasurementsUseCase = new GetLatestMeasurementsUseCase(measurementRepository);
export const exportMeasurementsCsvUseCase = new ExportMeasurementsCsvUseCase(measurementRepository);

// Provided port (progress, private-photos)
export const bodyWeightPort: BodyWeightPort = new BodyWeightService(measurementRepository);
export const bodyMetricsBackend = backend;
```

---

## UI

### Components

Specs: [components.md → Body Metrics](../../components.md#body-metrics).

| Component | File | Kind | Content |
|---|---|---|---|
| `MeasurementForm` | `measurement-form.astro` | Astro form | Date (default today, `max` = today), weight / body fat / 14 lengths with unit suffix (kg·lb, %, cm·in), notes (≤ 300). `inputmode="decimal"`. Sections: "Peso y grasa", "Medidas". Submit *Guardar* |
| `MeasurementChart` | `measurement-chart.tsx` | React island (Chart.js, [ADR-002](../../decisions/002-chartjs-react-island.md)) | Metric selector, ranges 30 d / 3 m / 1 a / todo, line + 7-entry moving average for body weight |
| `LatestMeasurementsCard` | `latest-measurements-card.astro` | Astro | Latest weight and body fat with Δ ("−1.8 kg en 34 días"); also on the `/profile` hub |
| `MeasurementList` | `measurement-list.astro` | Astro | Entries newest first, only fields with values, *Editar* / *Eliminar* (confirm "¿Eliminar esta medición?") |

### Interactive components (Astro islands)

- `MeasurementChart` (`client:visible`) fetches `GET /api/body-measurements/series` on metric or range change. Values are converted to display units in the endpoint response (`unit` field included).
- Delete uses a small inline script (`fetch` `DELETE`, then reload), like the photo gallery.

### Pages

| Route | Content |
|---|---|
| `/profile/measurements` | `LatestMeasurementsCard`, `MeasurementChart`, `MeasurementList` (20 per page, `?page=`), button *Nueva medición*. Empty state: "Aún no has registrado medidas". |
| `/profile/measurements/new` | `MeasurementForm` (create / merge). After save: 303 to `/profile/measurements` with toast "Medición guardada" or "Medición actualizada" when merged. |
| `/profile/measurements/[id]/edit` | `MeasurementForm` prefilled in display units; 404 page for a foreign or missing id. |
| `/profile` | `LatestMeasurementsCard` + link *Medidas* (FR-WT-045). |
| `/settings` | *Exportar medidas (CSV)* link (story 12.4). |

### API endpoints

| Method | Path | Use case | Notes |
|---|---|---|---|
| POST | `/api/body-measurements` | `LogMeasurementUseCase` | Form → 303 `/profile/measurements?saved=1\|merged=1`; 400 on validation errors (form re-rendered with Spanish messages) |
| POST | `/api/body-measurements/[id]` | `UpdateMeasurementUseCase` | Form (edit) → 303; 404 foreign / missing; 409 `MeasurementDateTakenError` |
| DELETE | `/api/body-measurements/[id]` | `DeleteMeasurementUseCase` | 204; 404 foreign / missing |
| GET | `/api/body-measurements/series?metric=weightKg&range=3m` | `GetMeasurementSeriesUseCase` | JSON `{ unit, points: SeriesPoint[] }` (display units) |
| GET | `/api/export/measurements.csv` | `ExportMeasurementsCsvUseCase` | `Content-Disposition: attachment; filename="gymup-measurements.csv"` |

All endpoints: 401 without a session; the user id always comes from the session.

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md): no mocks, real SQLite, Object Mothers.

| File | What |
|---|---|
| `tests/body-metrics/body-metric-units.test.ts` | kg↔lb, cm↔in, stored rounding 0.01, display rounding 0.1 |
| `tests/body-metrics/body-metric-rules.test.ts` | Every range boundary (min, max, min − 0.01, max + 0.01), empty entry, future date, notes 300 / 301, `mergeMeasurement` |
| `tests/body-metrics/measurement-series.test.ts` | Moving average example, ranges cutoff, `latestWithDelta` (no entry ≥ 30 days → delta null), `bodyWeightOn`, `nearestWeight` ±3 and tie |
| `tests/body-metrics/log-measurement.use-case.test.ts` | Create; same date → merge; lbs input stored in kg; validation errors |
| `tests/body-metrics/update-delete-measurement.use-case.test.ts` | Replace semantics, date collision, foreign id → not found |
| `tests/body-metrics/sqlite-body-measurement.repository.test.ts` | **Owner guard**: user B cannot find, list, update or delete user A's rows; unique `(user_id, measured_on)` |
| `tests/body-metrics/body-weight.service.test.ts` | `getBodyWeightOn`, `findNearest`, `listBodyWeights` never return another user's rows |
| `tests/body-metrics/export-measurements-csv.use-case.test.ts` | Header, column order, empty cells, quoting of notes with commas/quotes |
| `tests/supabase/rls-body-measurements.integration.test.ts` | **Required by ADR-023**: as a non-owner, `select` returns 0 rows, `insert` with the owner's `user_id` fails, `update` / `delete` affect 0 rows (pattern `rls-photo.integration.test.ts`) |

Mothers (`tests/body-metrics/mothers/`): `BodyMeasurementMother` (`.weightOnly(kg, date)`, `.full(date)`, `.withWaist(cm, date)`). `tests/body-metrics/test-db.ts` re-exports the workout-tracking harness.

```ts
// tests/supabase/rls-body-measurements.integration.test.ts (skeleton)
describe.skipIf(!enabled)('RLS — body_measurements (ADR-023)', () => {
  it('owner inserts a measurement', async () => {
    const { data, error } = await owner.from('body_measurements')
      .insert({ user_id: ownerId, measured_on: todayKey, weight_kg: 80 }).select().single();
    expect(error).toBeNull();
    rowId = data!.id;
  });
  it('non-owner cannot read it', async () => {
    const { data } = await nonOwner.from('body_measurements').select('*').eq('id', rowId);
    expect(data).toEqual([]);
  });
  it('non-owner cannot update or delete it', async () => {
    await nonOwner.from('body_measurements').update({ weight_kg: 1 }).eq('id', rowId);
    await nonOwner.from('body_measurements').delete().eq('id', rowId);
    const { data } = await owner.from('body_measurements').select('weight_kg').eq('id', rowId).single();
    expect(data!.weight_kg).toBe(80);
  });
});
```

---

## Flows

- [log-measurement.flow.md](./flows/log-measurement.flow.md)
