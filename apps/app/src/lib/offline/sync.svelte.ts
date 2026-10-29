import { invalidateCache } from './cache';
import { Outbox, type Command, type FailedItem, type Remap } from './outbox';
import { sendCommand } from './sender';
import { remapSnapshot } from './workout-session';

const POLL_MS = 15_000;

/**
 * Reactive facade over the outbox: how many changes are waiting, whether the server is reachable, and the
 * sync loop. It drains on app start, when the `online` event fires, when the app returns to the foreground,
 * after every enqueue, and every 15 seconds while something is pending.
 */
class SyncState {
  pending = $state(0);
  failed = $state<FailedItem[]>([]);
  syncing = $state(false);
  /** True after the last attempt failed for lack of signal. */
  offline = $state(false);

  readonly outbox = new Outbox(sendCommand);
  private started = false;
  private remapListeners = new Set<(remap: Remap) => void>();

  start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('online', () => void this.kick(true));
    window.addEventListener('offline', () => (this.offline = true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.kick();
    });
    setInterval(() => {
      if (this.pending > 0) void this.kick();
    }, POLL_MS);
    void this.refresh().then(() => this.kick());
  }

  onRemap(listener: (remap: Remap) => void): () => void {
    this.remapListeners.add(listener);
    return () => this.remapListeners.delete(listener);
  }

  async enqueue(command: Command): Promise<void> {
    await this.outbox.enqueue(command);
    await this.refresh();
    void this.kick();
  }

  async refresh(): Promise<void> {
    this.pending = await this.outbox.pendingCount();
    this.failed = await this.outbox.failed();
  }

  async kick(force = false): Promise<void> {
    if (this.syncing || this.pending === 0) return;
    this.syncing = true;
    try {
      const result = await this.outbox.drain({ force });
      this.offline = result.stoppedBy === 'network';
      for (const remap of result.remaps) {
        await remapSnapshot(remap.from, remap.to);
        this.remapListeners.forEach((l) => l(remap));
      }
      if (result.sent > 0) await invalidateCache(['/workouts']);
    } finally {
      this.syncing = false;
      await this.refresh();
    }
  }

  async retry(seq: number): Promise<void> {
    await this.outbox.retryFailed(seq);
    await this.refresh();
    void this.kick(true);
  }

  async discard(seq: number): Promise<void> {
    await this.outbox.discardFailed(seq);
    await this.refresh();
  }
}

export const sync = new SyncState();
