import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const line = { template: 'Se acabó el descanso.', text: 'Se acabó el descanso.', locale: 'es' as const, tone: 'normal' as const };
const coach = vi.hoisted(() => ({ coachAnnounce: vi.fn(), coachLine: vi.fn(), coachSay: vi.fn() }));
const voice = vi.hoisted(() => ({ scheduleAt: vi.fn(async () => true), cancelScheduled: vi.fn(async () => {}) }));

vi.mock('#lib/notify', () => ({ scheduleRestEnd: vi.fn(), cancelRestEnd: vi.fn(), vibrateRestEnd: vi.fn() }));
vi.mock('#lib/coach/coach.svelte', () => coach);
vi.mock('#lib/coach/voice.svelte', () => ({ coachVoice: voice }));

const { restTimer } = await import('./rest.svelte');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 30, 18, 0, 0));
  coach.coachLine.mockReturnValue(line);
});

afterEach(() => {
  restTimer.skip();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('rest timer and the Coach', () => {
  it('says "back to work" the instant the rest ends, and hands the same line to Android for a locked screen', async () => {
    restTimer.start(90, { exercise: 'Squat' });
    await Promise.resolve();
    expect(coach.coachLine).toHaveBeenCalledWith('restEnd', { restSeconds: 90, exercise: 'Squat' });
    expect(voice.scheduleAt).toHaveBeenCalledWith(line.text, 'es', Date.now() + 90_000);

    vi.advanceTimersByTime(45_000);
    expect(coach.coachSay).toHaveBeenCalledWith('restHalf', { restSeconds: 90, exercise: 'Squat' });
    expect(coach.coachAnnounce).not.toHaveBeenCalled();

    vi.advanceTimersByTime(45_000);
    expect(restTimer.seconds).toBe(0);
    expect(coach.coachAnnounce).toHaveBeenCalledWith(line, { speak: true });
    expect(voice.cancelScheduled).toHaveBeenCalled();
  });

  it('calls you back 30 s after the rest-end line, then every 30 s', () => {
    restTimer.start(60, { exercise: 'Squat' });
    vi.advanceTimersByTime(60_000);
    expect(coach.coachSay).not.toHaveBeenCalledWith('restLong', expect.anything());
    vi.advanceTimersByTime(30_000);
    expect(coach.coachSay).toHaveBeenCalledWith('restLong', { restSeconds: 60, exercise: 'Squat' });
    vi.advanceTimersByTime(30_000);
    expect(coach.coachSay.mock.calls.filter(([e]) => e === 'restLong')).toHaveLength(2);
    restTimer.stopNag();
    vi.advanceTimersByTime(120_000);
    expect(coach.coachSay.mock.calls.filter(([e]) => e === 'restLong')).toHaveLength(2);
  });

  it('follows the wall clock: waking up after the end only shows the line Android already said', async () => {
    restTimer.start(90, { exercise: 'Squat' });
    await Promise.resolve();
    await Promise.resolve();
    // The WebView slept: no ticks, then the clock jumps past the end.
    vi.setSystemTime(Date.now() + 120_000);
    vi.advanceTimersByTime(250);
    expect(coach.coachAnnounce).toHaveBeenCalledWith(line, { speak: false });
  });

  it('stays quiet when no sets remain, and skipping cancels Android’s line', () => {
    restTimer.start(90);
    expect(coach.coachLine).not.toHaveBeenCalled();
    vi.advanceTimersByTime(90_000);
    expect(coach.coachAnnounce).not.toHaveBeenCalled();
    expect(coach.coachSay).not.toHaveBeenCalled();

    restTimer.start(90, { exercise: 'Squat' });
    restTimer.skip();
    expect(voice.cancelScheduled).toHaveBeenCalled();
    vi.advanceTimersByTime(90_000);
    expect(coach.coachAnnounce).not.toHaveBeenCalled();
  });
});
