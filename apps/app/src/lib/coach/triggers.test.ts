import { describe, expect, it } from 'vitest';
import { COACH_EVENTS } from './lines';
import { LIMIT_MS, Limiter, reactToSet, speaksAloud } from './triggers';

describe('speaksAloud', () => {
  it('keeps the Home line of the day silent and speaks every workout reaction', () => {
    expect(speaksAloud('home')).toBe(false);
    for (const e of COACH_EVENTS.filter((e) => e !== 'home')) expect(speaksAloud(e), e).toBe(true);
  });
});

describe('Limiter', () => {
  it('lets one line through every ~20 s', () => {
    const l = new Limiter();
    expect(l.allow('setDone', 0)).toBe(true);
    expect(l.allow('restHalf', 5_000)).toBe(false);
    expect(l.allow('setDone', LIMIT_MS - 1)).toBe(false);
    expect(l.allow('setDone', LIMIT_MS)).toBe(true);
  });

  it('never holds back records, progress, rest end, finish or lowering the weight', () => {
    const l = new Limiter();
    expect(l.allow('setDone', 0)).toBe(true);
    for (const e of ['pr', 'progressUp', 'setDrop', 'restEnd', 'finish', 'weightDrop'] as const) expect(l.allow(e, 1_000)).toBe(true);
    // An urgent line restarts the clock for the others.
    expect(l.allow('restLong', 1_000 + LIMIT_MS - 1)).toBe(false);
  });
});

describe('reactToSet', () => {
  const last = { weight: 60, reps: 8 };
  const record = { weight: 70, reps: 5 };

  it('celebrates beating last session: heavier, or more reps at no less weight', () => {
    expect(reactToSet({ weight: 62.5, reps: 6 }, last, record)).toBe('progressUp');
    expect(reactToSet({ weight: 60, reps: 9 }, last, record)).toBe('progressUp');
    expect(reactToSet({ weight: 57.5, reps: 12 }, last, record)).toBe('setDone');
    expect(reactToSet({ weight: 60, reps: 8 }, last, record)).toBe('setDone');
  });

  it('prefers a record over progress when both apply', () => {
    expect(reactToSet({ weight: 72.5, reps: 3 }, last, record)).toBe('pr');
    expect(reactToSet({ weight: 70, reps: 6 }, last, record)).toBe('pr');
  });

  it('counts sets already done today when judging a record', () => {
    expect(reactToSet({ weight: 72.5, reps: 3 }, last, record, [{ weight: 75, reps: 2 }])).toBe('progressUp');
    expect(reactToSet({ weight: 77.5, reps: 1 }, last, record, [{ weight: 75, reps: 2 }])).toBe('pr');
  });

  it('keeps warm-ups and sets with no history plain', () => {
    expect(reactToSet({ weight: 100, reps: 10, type: 'warmup' }, last, record)).toBe('setDone');
    expect(reactToSet({ weight: 40, reps: 10 }, null, null)).toBe('setDone');
  });

  describe('compared with the previous set today', () => {
    const prev = { weight: 10, reps: 10 };

    it('reacts to less weight, or fewer reps at the same weight, than the previous working set', () => {
      expect(reactToSet({ weight: 10, reps: 8 }, null, null, [prev], prev)).toBe('setDrop');
      expect(reactToSet({ weight: 7.5, reps: 10 }, null, null, [prev], prev)).toBe('setDrop');
      expect(reactToSet({ weight: 7.5, reps: 12 }, null, null, [prev], prev)).toBe('setDrop');
      expect(reactToSet({ weight: 10, reps: 10 }, null, null, [prev], prev)).toBe('setDone');
      expect(reactToSet({ weight: 10, reps: 12 }, null, null, [prev], prev)).toBe('setDone');
    });

    it('treats a heavier set than the previous one as progress, even with fewer reps', () => {
      expect(reactToSet({ weight: 12.5, reps: 8 }, null, null, [prev], prev)).toBe('progressUp');
      expect(reactToSet({ weight: 12.5, reps: 8 }, { weight: 15, reps: 8 }, null, [prev], prev)).toBe('progressUp');
      expect(reactToSet({ weight: 12.5, reps: 8 }, null, { weight: 12.5, reps: 5 }, [prev], prev)).toBe('pr');
      expect(reactToSet({ weight: 12.5, reps: 8, type: 'warmup' }, null, null, [prev], prev)).toBe('setDone');
    });

    it('leaves drop sets, warm-ups and the first set alone', () => {
      expect(reactToSet({ weight: 7.5, reps: 8, type: 'drop' }, null, null, [prev], prev)).toBe('setDone');
      expect(reactToSet({ weight: 5, reps: 8, type: 'warmup' }, null, null, [prev], prev)).toBe('setDone');
      expect(reactToSet({ weight: 10, reps: 8 }, null, null, [], null)).toBe('setDone');
      expect(reactToSet({ weight: 10, reps: 8 }, null, null, [], { weight: 20, reps: 12, type: 'warmup' })).toBe('setDone');
    });

    it('ranks below a record and beating last session', () => {
      expect(reactToSet({ weight: 10, reps: 8 }, { weight: 9, reps: 8 }, null, [prev], prev)).toBe('progressUp');
      expect(reactToSet({ weight: 10, reps: 8 }, null, { weight: 9, reps: 8 }, [prev], prev)).toBe('setDrop');
      expect(reactToSet({ weight: 12, reps: 1 }, null, { weight: 11, reps: 5 }, [prev], prev)).toBe('pr');
    });
  });
});
