import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UpsertSetRequest } from '@gym-up/contracts';
import { ApiRequestError, NetworkError } from '../api/errors';
import { idb } from './idb';
import { backoffMs, Outbox, type Command } from './outbox';

const W1 = '11111111-1111-4111-8111-111111111111';
const W2 = '22222222-2222-4222-8222-222222222222';

function set(id: string, reps = 10): UpsertSetRequest {
  return { id, exerciseId: 'e1', setNumber: 1, reps, weight: 50, weightUnit: 'kg', completed: true, notes: null };
}
const upsert = (workoutId: string, id: string, reps = 10): Command => ({ type: 'upsert-set', workoutId, set: set(id, reps) });
const finish = (workoutId: string): Command => ({ type: 'finish-workout', workoutId });

let clock = 1_000_000;
const now = () => clock;

beforeEach(async () => {
  await idb.clear('outbox');
  await idb.clear('failed');
  clock = 1_000_000;
});

describe('Outbox', () => {
  it('sends commands in the order they were enqueued and empties the queue', async () => {
    const sent: Command[] = [];
    const outbox = new Outbox(async (c) => void sent.push(c), now);
    await outbox.enqueue({ type: 'start-workout', id: W1, routineDayId: 'd1' });
    await outbox.enqueue(upsert(W1, 'a'));
    await outbox.enqueue(finish(W1));

    const r = await outbox.drain();

    expect(sent.map((c) => c.type)).toEqual(['start-workout', 'upsert-set', 'finish-workout']);
    expect(r).toMatchObject({ sent: 3, failed: 0, remaining: 0, stoppedBy: null });
  });

  it('keeps everything, in order, while offline and resumes after the backoff', async () => {
    let online = false;
    const sent: string[] = [];
    const outbox = new Outbox(async (c) => {
      if (!online) throw new NetworkError();
      sent.push(c.type);
    }, now);
    await outbox.enqueue({ type: 'start-workout', id: W1, routineDayId: 'd1' });
    await outbox.enqueue(upsert(W1, 'a'));

    const first = await outbox.drain();
    expect(first).toMatchObject({ sent: 0, remaining: 2, stoppedBy: 'network' });
    expect((await outbox.items())[0]!.attempts).toBe(1);

    // Still inside the backoff window: nothing is attempted.
    online = true;
    expect((await outbox.drain()).stoppedBy).toBe('backoff');
    expect(sent).toEqual([]);

    clock += backoffMs(1) + 1;
    const second = await outbox.drain();
    expect(sent).toEqual(['start-workout', 'upsert-set']);
    expect(second.remaining).toBe(0);
  });

  it('can ignore the backoff with force (the user came back online)', async () => {
    let online = false;
    const outbox = new Outbox(async () => {
      if (!online) throw new NetworkError();
    }, now);
    await outbox.enqueue(finish(W1));
    await outbox.drain();
    online = true;
    expect((await outbox.drain({ force: true })).remaining).toBe(0);
  });

  it('retries on 5xx and 429 but not on 4xx', async () => {
    const outbox = new Outbox(async () => {
      throw new ApiRequestError(503, 'unavailable');
    }, now);
    await outbox.enqueue(finish(W1));
    expect((await outbox.drain()).stoppedBy).toBe('network');
    expect((await outbox.items())).toHaveLength(1);
    expect(await outbox.failed()).toHaveLength(0);
  });

  it('moves a rejected command to failed and keeps draining the rest', async () => {
    const sent: string[] = [];
    const outbox = new Outbox(async (c) => {
      if (c.type === 'upsert-set') throw new ApiRequestError(400, 'reps out of range');
      sent.push(c.type);
    }, now);
    await outbox.enqueue(upsert(W1, 'a'));
    await outbox.enqueue(finish(W1));

    const r = await outbox.drain();

    expect(r).toMatchObject({ sent: 1, failed: 1, remaining: 0 });
    expect(sent).toEqual(['finish-workout']);
    const failed = await outbox.failed();
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ status: 400, error: 'reps out of range' });
  });

  it('stops on 401 without counting an attempt, so the commands survive a re-login', async () => {
    const outbox = new Outbox(async () => {
      throw new ApiRequestError(401, 'Invalid or expired session');
    }, now);
    await outbox.enqueue(finish(W1));
    const r = await outbox.drain();
    expect(r.stoppedBy).toBe('auth');
    const [item] = await outbox.items();
    expect(item!.attempts).toBe(0);
  });

  it('coalesces repeated edits of the same set into one command, keeping its position', async () => {
    const outbox = new Outbox(async () => {}, now);
    await outbox.enqueue(upsert(W1, 'a', 8));
    await outbox.enqueue(finish(W1));
    await outbox.enqueue(upsert(W1, 'a', 12));

    const items = await outbox.items();
    expect(items.map((i) => i.command.type)).toEqual(['upsert-set', 'finish-workout']);
    expect((items[0]!.command as Extract<Command, { type: 'upsert-set' }>).set.reps).toBe(12);
  });

  it('does not coalesce different sets', async () => {
    const outbox = new Outbox(async () => {}, now);
    await outbox.enqueue(upsert(W1, 'a'));
    await outbox.enqueue(upsert(W1, 'b'));
    expect(await outbox.pendingCount()).toBe(2);
    expect([...(await outbox.pendingSetIds(W1))].sort()).toEqual(['a', 'b']);
  });

  it('rewrites later commands when the server answers start-workout with another workout', async () => {
    const seen: Command[] = [];
    const outbox = new Outbox(async (c) => {
      seen.push(c);
      if (c.type === 'start-workout') return { remap: { from: W1, to: W2 } };
    }, now);
    await outbox.enqueue({ type: 'start-workout', id: W1, routineDayId: 'd1' });
    await outbox.enqueue(upsert(W1, 'a'));
    await outbox.enqueue(finish(W1));

    const r = await outbox.drain();

    expect(r.remaps).toEqual([{ from: W1, to: W2 }]);
    expect(seen[1]).toMatchObject({ type: 'upsert-set', workoutId: W2 });
    expect(seen[2]).toMatchObject({ type: 'finish-workout', workoutId: W2 });
  });

  it('never runs two drains at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const outbox = new Outbox(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    }, now);
    await outbox.enqueue(finish(W1));
    await outbox.enqueue(finish(W2));

    await Promise.all([outbox.drain(), outbox.drain(), outbox.drain()]);

    expect(maxInFlight).toBe(1);
    expect(await outbox.pendingCount()).toBe(0);
  });

  it('lets the user retry or discard a failed command', async () => {
    let reject = true;
    const outbox = new Outbox(async () => {
      if (reject) throw new ApiRequestError(403, 'forbidden');
    }, now);
    await outbox.enqueue(finish(W1));
    await outbox.drain();
    const [failed] = await outbox.failed();
    expect(failed).toBeDefined();

    reject = false;
    await outbox.retryFailed(failed!.seq);
    expect(await outbox.failed()).toHaveLength(0);
    expect((await outbox.drain()).sent).toBe(1);

    reject = true;
    await outbox.enqueue(finish(W2));
    await outbox.drain();
    const [again] = await outbox.failed();
    await outbox.discardFailed(again!.seq);
    expect(await outbox.failed()).toHaveLength(0);
  });
});

describe('backoffMs', () => {
  it('doubles from one second and caps at five minutes', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([1000, 2000, 4000, 8000]);
    expect(backoffMs(30)).toBe(5 * 60 * 1000);
  });
});
