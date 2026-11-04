import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bridge = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: bridge.invoke }));
vi.mock('#lib/i18n', () => ({ t: (key: string) => key }));

import { cancelCreatineReminder, scheduleCreatineReminder } from './notify';

type NativeNotification = {
  id: number;
  channelId: string;
  body: string;
  schedule: { at: { date: Date; repeating: boolean; allowWhileIdle: boolean } };
  sourceJson: string;
};

const batches = () => bridge.invoke.mock.calls
  .filter(([command]) => command === 'plugin:notification|batch')
  .map(([, args]) => args.notifications as NativeNotification[]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 3, 8, 30));
  bridge.invoke.mockReset();
  bridge.invoke.mockResolvedValue(undefined);
  // The public sendNotification API is fire-and-forget, not a native acknowledgement.
  const Notification = Object.assign(vi.fn(function () {}), { permission: 'granted' });
  vi.stubGlobal('window', { __TAURI_INTERNALS__: { invoke: bridge.invoke }, Notification });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('native creatine reminders', () => {
  it('awaits the Android batch and stores a restorable source for every alarm', async () => {
    expect(await scheduleCreatineReminder(false)).toBe(true);
    expect(batches()).toHaveLength(1);
    const notifications = batches()[0]!;
    expect(notifications).toHaveLength(30 * 14);
    expect(new Set(notifications.map((n) => n.id)).size).toBe(notifications.length);
    for (const n of notifications) {
      const at = n.schedule.at;
      expect(at.date.getTime()).toBeGreaterThan(Date.now());
      expect(at.date.getHours()).toBeGreaterThanOrEqual(9);
      expect(at.date.getHours()).toBeLessThanOrEqual(22);
      expect(at).toMatchObject({ repeating: false, allowWhileIdle: true });
      // Android's restore receiver parses sourceJson after a reboot, not the JS objects.
      expect(JSON.parse(n.sourceJson)).toMatchObject({
        id: n.id, channelId: n.channelId,
        schedule: { at: { date: at.date.toISOString() } },
      });
    }
    expect(bridge.invoke.mock.calls.some(([command]) => command === 'plugin:notification|notify')).toBe(false);
    expect(bridge.invoke.mock.calls.find(([command]) => command === 'plugin:notification|create_channel')?.[1]).toEqual({
      id: notifications[0]!.channelId, name: 'supplements.reminderChannel', importance: 3, vibration: true,
    });
  });

  it('does not report success before Android accepts the alarms', async () => {
    let accept!: () => void;
    const accepted = new Promise<void>((resolve) => { accept = resolve; });
    bridge.invoke.mockImplementation((command) => command === 'plugin:notification|batch' ? accepted : Promise.resolve());
    let completed = false;
    const result = scheduleCreatineReminder(false).then((ok) => { completed = true; return ok; });
    await vi.waitFor(() => expect(batches()).toHaveLength(1));
    expect(completed).toBe(false);
    accept();
    expect(await result).toBe(true);
  });

  it('reports native scheduling failures instead of showing a false enabled state', async () => {
    bridge.invoke.mockImplementation((command) => command === 'plugin:notification|batch'
      ? Promise.reject(new Error('Alarm rejected')) : Promise.resolve());
    expect(await scheduleCreatineReminder(false)).toBe(false);
  });

  it('does not replace alarms when cancellation fails', async () => {
    bridge.invoke.mockRejectedValue(new Error('Native bridge unavailable'));
    expect(await scheduleCreatineReminder(false)).toBe(false);
    expect(batches()).toHaveLength(0);
  });

  it('reports cancellation failures so the caller can retain its enabled preference', async () => {
    bridge.invoke.mockRejectedValue(new Error('Native bridge unavailable'));
    expect(await cancelCreatineReminder()).toBe(false);
  });

  it('skips today after taking creatine, then resumes tomorrow at 09:00', async () => {
    expect(await scheduleCreatineReminder(true)).toBe(true);
    const notifications = batches()[0]!;
    expect(notifications).toHaveLength(29 * 14);
    expect(notifications[0]!.schedule.at.date).toEqual(new Date(2026, 10, 4, 9));
  });

  it('only schedules future slots when opened during or after the reminder window', async () => {
    vi.setSystemTime(new Date(2026, 10, 3, 15));
    await scheduleCreatineReminder(false);
    expect(batches()[0]![0]!.schedule.at.date).toEqual(new Date(2026, 10, 3, 16));
    vi.setSystemTime(new Date(2026, 10, 3, 23));
    await scheduleCreatineReminder(false);
    expect(batches()[1]![0]!.schedule.at.date).toEqual(new Date(2026, 10, 4, 9));
  });

  it('serializes refreshes and cancellation so switching off wins over an in-flight refresh', async () => {
    let accept!: () => void;
    const accepted = new Promise<void>((resolve) => { accept = resolve; });
    bridge.invoke.mockImplementation((command) => command === 'plugin:notification|batch' ? accepted : Promise.resolve());
    const refresh = scheduleCreatineReminder(false);
    await vi.waitFor(() => expect(batches()).toHaveLength(1));
    const cancel = cancelCreatineReminder();
    await Promise.resolve();
    expect(bridge.invoke.mock.calls.filter(([c]) => c === 'plugin:notification|cancel')).toHaveLength(1);
    accept();
    await Promise.all([refresh, cancel]);
    expect(bridge.invoke.mock.calls.at(-1)?.slice(0, 2)).toEqual(['plugin:notification|cancel', {
      notifications: expect.arrayContaining([7002, 7100, 7519]),
    }]);
  });

  it('applies a newly taken dose after an in-flight cached refresh', async () => {
    let accept!: () => void;
    const accepted = new Promise<void>((resolve) => { accept = resolve; });
    bridge.invoke.mockImplementation((command) => command === 'plugin:notification|batch' ? accepted : Promise.resolve());
    const refresh = scheduleCreatineReminder(false);
    await vi.waitFor(() => expect(batches()).toHaveLength(1));
    const taken = scheduleCreatineReminder(true);
    await Promise.resolve();
    expect(batches()).toHaveLength(1);
    accept();
    await Promise.all([refresh, taken]);
    expect(batches()).toHaveLength(2);
    expect(batches()[1]![0]!.schedule.at.date).toEqual(new Date(2026, 10, 4, 9));
  });

  it('does not schedule without permission or outside the installed app', async () => {
    Object.defineProperty(window.Notification, 'permission', { value: 'denied' });
    window.Notification.requestPermission = vi.fn(async () => 'denied' as const);
    expect(await scheduleCreatineReminder(false)).toBe(false);
    vi.stubGlobal('window', {});
    expect(await scheduleCreatineReminder(false)).toBe(false);
    expect(batches()).toHaveLength(0);
  });
});
