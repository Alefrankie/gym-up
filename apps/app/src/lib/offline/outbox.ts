// Offline outbox (ADR-025, amended by ADR-027 section 5).
//
// Every mutation of a live workout is a command. Commands are stored in IndexedDB first and sent to the
// server later, one at a time and in order. Replaying a command is always safe because the API upserts by
// client-generated id, so "at least once" delivery cannot duplicate data.
//
// Outcomes of a send attempt:
//   ok            the command is removed
//   network / 5xx / 408 / 429   it stays; attempts grows and the next try is delayed (exponential, max 5 min)
//   401           it stays and draining stops (the user must sign in again); attempts do not grow
//   other 4xx     the server rejected it for good: it moves to `failed` and draining continues

import type { UpsertSetRequest } from '@gym-up/contracts';
import { ApiRequestError, NetworkError } from '../api/errors';
import { idb } from './idb';

export type Command =
  | { type: 'start-workout'; id: string; routineDayId: string; date?: string }
  | { type: 'upsert-set'; workoutId: string; set: UpsertSetRequest }
  | { type: 'remove-set'; workoutId: string; exerciseId: string; setNumber: number }
  | { type: 'finish-workout'; workoutId: string; durationSeconds?: number }
  | { type: 'discard-workout'; workoutId: string }
  | { type: 'mark-supplement'; supplementId: string; day: string; taken: boolean };

export interface OutboxItem {
  seq?: number;
  command: Command;
  createdAt: number;
  attempts: number;
  /** Epoch ms before which the item is not retried (unless drained with `force`). */
  nextAttemptAt: number;
}

export interface FailedItem extends OutboxItem {
  seq: number;
  error: string;
  status: number;
}

/** The server answered `start-workout` with another workout (one per user per day): ids must be remapped. */
export interface Remap {
  from: string;
  to: string;
}

export type Sender = (command: Command) => Promise<{ remap?: Remap } | void>;

export interface DrainResult {
  sent: number;
  failed: number;
  remaining: number;
  /** Why draining stopped early, if it did. */
  stoppedBy: 'network' | 'auth' | 'backoff' | null;
  remaps: Remap[];
}

const MAX_BACKOFF_MS = 5 * 60 * 1000;

export const backoffMs = (attempts: number) => Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1));

function commandKey(c: Command): string | null {
  if (c.type === 'upsert-set') return `${c.workoutId}:${c.set.id}`;
  // Ticking and unticking the same supplement on the same day: only the last tap matters.
  if (c.type === 'mark-supplement') return `supplement:${c.supplementId}:${c.day}`;
  return null;
}

function retargeted(c: Command, remap: Remap): Command {
  switch (c.type) {
    case 'start-workout':
      return c.id === remap.from ? { ...c, id: remap.to } : c;
    case 'upsert-set':
      return c.workoutId === remap.from ? { ...c, workoutId: remap.to } : c;
    case 'remove-set':
    case 'finish-workout':
    case 'discard-workout':
      return c.workoutId === remap.from ? { ...c, workoutId: remap.to } : c;
    case 'mark-supplement':
      return c;
  }
}

export class Outbox {
  private draining = false;

  constructor(
    private readonly send: Sender,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Adds a command. An `upsert-set` for a set that already has a pending command replaces it in place
   * (only the latest values matter, and its position before a later `finish-workout` is preserved).
   */
  async enqueue(command: Command): Promise<void> {
    const key = commandKey(command);
    if (key) {
      const items = await this.items();
      const same = items.find((i) => commandKey(i.command) === key);
      if (same) {
        await idb.put('outbox', { ...same, command, attempts: 0, nextAttemptAt: 0 });
        return;
      }
    }
    await idb.add('outbox', { command, createdAt: this.now(), attempts: 0, nextAttemptAt: 0 } satisfies OutboxItem);
  }

  /**
   * Removes every queued command of a workout (its sets, its finish) because the workout is being cancelled.
   * Returns true when its `start-workout` was still waiting: the server never heard of it, so there is nothing to cancel there.
   */
  async dropWorkout(workoutId: string): Promise<boolean> {
    let startNeverSent = false;
    for (const i of await this.items()) {
      const c = i.command;
      const mine = c.type === 'start-workout' ? c.id === workoutId : 'workoutId' in c && c.workoutId === workoutId;
      if (!mine) continue;
      if (c.type === 'start-workout') startNeverSent = true;
      await idb.delete('outbox', i.seq!);
    }
    return startNeverSent;
  }

  async items(): Promise<OutboxItem[]> {
    return (await idb.getAll<OutboxItem>('outbox')).sort((a, b) => a.seq! - b.seq!);
  }

  async pendingCount(): Promise<number> {
    return idb.count('outbox');
  }

  /** Ids of sets with a command still waiting; the UI keeps local values for these when merging server data. */
  async pendingSetIds(workoutId: string): Promise<Set<string>> {
    const ids = new Set<string>();
    for (const i of await this.items()) {
      if (i.command.type === 'upsert-set' && i.command.workoutId === workoutId) ids.add(i.command.set.id);
    }
    return ids;
  }

  /** True while a set removal of this workout has not reached the server: its set numbers there are still the old ones. */
  async hasPendingRemoval(workoutId: string): Promise<boolean> {
    return (await this.items()).some((i) => i.command.type === 'remove-set' && i.command.workoutId === workoutId);
  }

  async failed(): Promise<FailedItem[]> {
    return (await idb.getAll<FailedItem>('failed')).sort((a, b) => a.seq - b.seq);
  }

  /** Puts a failed command back at the end of the queue. */
  async retryFailed(seq: number): Promise<void> {
    const item = await idb.get<FailedItem>('failed', seq);
    if (!item) return;
    await idb.delete('failed', seq);
    await idb.add('outbox', { command: item.command, createdAt: item.createdAt, attempts: 0, nextAttemptAt: 0 } satisfies OutboxItem);
  }

  async discardFailed(seq: number): Promise<void> {
    await idb.delete('failed', seq);
  }

  /** Used on sign-out: another account must never receive this user's commands. */
  async discardAll(): Promise<void> {
    await idb.clear('outbox');
    await idb.clear('failed');
  }

  /** Sends pending commands in order. Only one drain runs at a time. */
  async drain(options: { force?: boolean } = {}): Promise<DrainResult> {
    const result: DrainResult = { sent: 0, failed: 0, remaining: 0, stoppedBy: null, remaps: [] };
    if (this.draining) {
      result.remaining = await this.pendingCount();
      return result;
    }
    this.draining = true;
    try {
      for (;;) {
        const item = (await this.items())[0];
        if (!item) break;
        if (!options.force && item.nextAttemptAt > this.now()) {
          result.stoppedBy = 'backoff';
          break;
        }
        try {
          const outcome = await this.send(item.command);
          await idb.delete('outbox', item.seq!);
          result.sent++;
          if (outcome?.remap) {
            result.remaps.push(outcome.remap);
            await this.applyRemap(outcome.remap);
          }
        } catch (err) {
          if (err instanceof ApiRequestError && err.status === 401) {
            result.stoppedBy = 'auth';
            break;
          }
          const retryable =
            err instanceof NetworkError ||
            (err instanceof ApiRequestError && (err.status >= 500 || err.status === 408 || err.status === 429));
          if (retryable) {
            const attempts = item.attempts + 1;
            await idb.put('outbox', { ...item, attempts, nextAttemptAt: this.now() + backoffMs(attempts) });
            result.stoppedBy = 'network';
            break;
          }
          // The server rejected the command (validation, ownership, unknown workout): keep it for the user.
          const status = err instanceof ApiRequestError ? err.status : 0;
          const message = err instanceof Error ? err.message : 'Error desconocido';
          await idb.delete('outbox', item.seq!);
          await idb.put('failed', { ...item, seq: item.seq!, error: message, status } satisfies FailedItem);
          result.failed++;
        }
      }
    } finally {
      this.draining = false;
    }
    result.remaining = await this.pendingCount();
    return result;
  }

  private async applyRemap(remap: Remap): Promise<void> {
    for (const item of await this.items()) {
      const next = retargeted(item.command, remap);
      if (next !== item.command) await idb.put('outbox', { ...item, command: next });
    }
  }
}
