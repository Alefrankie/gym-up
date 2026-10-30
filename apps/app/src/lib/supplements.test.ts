import { describe, expect, it, vi } from 'vitest';

vi.mock('#lib/offline/cache', () => ({ cachedGet: vi.fn(), updateCached: vi.fn() }));
vi.mock('#lib/offline/sync.svelte', () => ({ sync: { enqueue: vi.fn() } }));

const { withMark } = await import('./supplements');

const list = (days: string[], taken = false) => ({
  day: '2026-10-30',
  items: [{ id: 's1', name: 'Creatina', taken, days, streak: 0 }],
});

describe('withMark', () => {
  it('ticks today and counts the streak back from today', () => {
    const next = withMark(list(['2026-10-28', '2026-10-29']), 's1', true);
    expect(next.items[0]).toMatchObject({ taken: true, streak: 3, days: ['2026-10-28', '2026-10-29', '2026-10-30'] });
  });

  it('fills in a past day without ticking today', () => {
    const next = withMark(list(['2026-10-27', '2026-10-29']), 's1', true, '2026-10-28');
    expect(next.items[0]).toMatchObject({ taken: false, streak: 3, days: ['2026-10-27', '2026-10-28', '2026-10-29'] });
  });

  it('unticks a past day and breaks the streak there', () => {
    const next = withMark(list(['2026-10-28', '2026-10-29', '2026-10-30'], true), 's1', false, '2026-10-28');
    expect(next.items[0]).toMatchObject({ taken: true, streak: 2, days: ['2026-10-29', '2026-10-30'] });
  });
});
