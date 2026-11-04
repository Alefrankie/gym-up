import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/offline/cache', () => ({ cachedGet: vi.fn(), updateCached: vi.fn() }));
vi.mock('#lib/offline/sync.svelte', () => ({ sync: { enqueue: vi.fn(), outbox: { items: vi.fn(async () => []) } } }));
vi.mock('#lib/notify', () => ({ scheduleCreatineReminder: vi.fn(async () => true), cancelCreatineReminder: vi.fn(async () => true) }));

const { withMark, loadSupplements, persistMark, creatineReminderError } = await import('./supplements');
const { sync } = await import('#lib/offline/sync.svelte');
const { get } = await import('svelte/store');
const { cachedGet, updateCached } = await import('#lib/offline/cache');
const { scheduleCreatineReminder, cancelCreatineReminder } = await import('#lib/notify');

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

describe('creatine reminder lifecycle', () => {
  let preferences: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    creatineReminderError.set(false);
    vi.mocked(sync.outbox.items).mockResolvedValue([]);
    vi.mocked(scheduleCreatineReminder).mockResolvedValue(true);
    vi.mocked(cancelCreatineReminder).mockResolvedValue(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 30, 12));
    preferences = new Map([['gym-up:creatine-reminder', 'on']]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => preferences.get(key) ?? null,
      setItem: (key: string, value: string) => preferences.set(key, value),
      removeItem: (key: string) => preferences.delete(key),
    });
    vi.mocked(updateCached).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renews enabled reminders when the dashboard loads supplements, not only on the supplements screen', async () => {
    vi.mocked(cachedGet).mockResolvedValue({ data: list([]), stale: false, fetchedAt: Date.now() });
    await loadSupplements('2026-10-30', vi.fn());
    expect(scheduleCreatineReminder).toHaveBeenCalledWith(false);
  });

  it('renews from cached data even when the network is unavailable', async () => {
    const cached = list(['2026-10-30'], true);
    vi.mocked(cachedGet).mockImplementationOnce(async (_path, _schema, options) => {
      options?.onCached?.({ data: cached, stale: false, fetchedAt: Date.now() });
      return { data: cached, stale: true, fetchedAt: Date.now() };
    });
    const onCached = vi.fn();
    await loadSupplements('2026-10-30', onCached);
    expect(onCached).toHaveBeenCalledWith(cached);
    expect(scheduleCreatineReminder).toHaveBeenCalledWith(true);
  });

  it('stops today’s reminders when a dose is ticked from any screen', async () => {
    await persistMark(list(['2026-10-30'], true), 's1', true);
    expect(scheduleCreatineReminder).toHaveBeenCalledWith(true);
  });

  it('resumes today’s reminders if the dose is unticked', async () => {
    await persistMark(list([]), 's1', false);
    expect(scheduleCreatineReminder).toHaveBeenCalledWith(false);
  });

  it('does not change today’s reminders when filling in an old dose', async () => {
    await persistMark(list(['2026-10-29']), 's1', true, '2026-10-29');
    expect(scheduleCreatineReminder).not.toHaveBeenCalled();
  });

  it('does not enable reminders implicitly when permission exists but the reminder is switched off', async () => {
    preferences.clear();
    vi.mocked(cachedGet).mockResolvedValue({ data: list([]), stale: false, fetchedAt: Date.now() });
    await loadSupplements('2026-10-30', vi.fn());
    await persistMark(list(['2026-10-30'], true), 's1', true);
    expect(scheduleCreatineReminder).not.toHaveBeenCalled();
  });

  it('cancels reminders if creatine was removed', async () => {
    vi.mocked(cachedGet).mockResolvedValue({ data: { day: '2026-10-30', items: [] }, stale: false, fetchedAt: Date.now() });
    await loadSupplements('2026-10-30', vi.fn());
    expect(cancelCreatineReminder).toHaveBeenCalled();
    expect(preferences.has('gym-up:creatine-reminder')).toBe(false);
  });

  it('does not roll back a local dose when an older GET finishes after the tap', async () => {
    let resolve!: (value: { data: ReturnType<typeof list>; stale: boolean; fetchedAt: number }) => void;
    vi.mocked(cachedGet).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const loading = loadSupplements('2026-10-30', vi.fn());
    await vi.waitFor(() => expect(cachedGet).toHaveBeenCalled());
    await persistMark(list(['2026-10-30'], true), 's1', true);
    resolve({ data: list([]), stale: false, fetchedAt: Date.now() });
    const loaded = await loading;
    expect(loaded.data.items[0]!.taken).toBe(true);
    expect(scheduleCreatineReminder).toHaveBeenLastCalledWith(true);
  });

  it('merges pending offline marks even if they drain before the GET returns', async () => {
    vi.mocked(sync.outbox.items).mockResolvedValueOnce([{
      command: { type: 'mark-supplement', supplementId: 's1', day: '2026-10-30', taken: true },
      createdAt: Date.now(), attempts: 0, nextAttemptAt: 0,
    }]);
    vi.mocked(cachedGet).mockResolvedValue({ data: list([]), stale: false, fetchedAt: Date.now() });
    const loaded = await loadSupplements('2026-10-30', vi.fn());
    expect(loaded.data.items[0]!.taken).toBe(true);
    expect(scheduleCreatineReminder).toHaveBeenLastCalledWith(true);
  });

  it('exposes automatic renewal failures instead of claiming the schedule is healthy', async () => {
    vi.mocked(scheduleCreatineReminder).mockResolvedValue(false);
    vi.mocked(cachedGet).mockResolvedValue({ data: list([]), stale: false, fetchedAt: Date.now() });
    await loadSupplements('2026-10-30', vi.fn());
    await Promise.resolve();
    expect(get(creatineReminderError)).toBe(true);
  });

  it('retains the preference for a later cancellation retry if native cancellation fails', async () => {
    vi.mocked(cancelCreatineReminder).mockResolvedValue(false);
    vi.mocked(cachedGet).mockResolvedValue({ data: { day: '2026-10-30', items: [] }, stale: false, fetchedAt: Date.now() });
    await loadSupplements('2026-10-30', vi.fn());
    await Promise.resolve();
    expect(preferences.get('gym-up:creatine-reminder')).toBe('on');
    expect(get(creatineReminderError)).toBe(true);
  });

  it('does not delete the enabled preference when a cache without creatine is superseded by the network', async () => {
    let cancel!: (result: boolean) => void;
    vi.mocked(cancelCreatineReminder).mockReturnValueOnce(new Promise((resolve) => { cancel = resolve; }));
    vi.mocked(cachedGet).mockImplementationOnce(async (_path, _schema, options) => {
      options?.onCached?.({ data: { day: '2026-10-30', items: [] }, stale: false, fetchedAt: Date.now() });
      return { data: list([]), stale: false, fetchedAt: Date.now() };
    });
    await loadSupplements('2026-10-30', vi.fn());
    cancel(true);
    await Promise.resolve();
    expect(preferences.get('gym-up:creatine-reminder')).toBe('on');
    expect(scheduleCreatineReminder).toHaveBeenCalledWith(false);
  });
});
