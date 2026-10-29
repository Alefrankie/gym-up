import type { Supplement } from '@db/schema';

export const MAX_SUPPLEMENTS = 12;
/** Offered on first use so the checklist is useful from the first open. */
export const DEFAULT_SUPPLEMENTS = ['Creatina', 'Proteína', 'Preentreno'] as const;

export class SupplementNotFoundError extends Error {
  override readonly name = 'SupplementNotFoundError';
  constructor(id: string) {
    super(`Supplement not found: ${id}`);
  }
}

export class SupplementLimitError extends Error {
  override readonly name = 'SupplementLimitError';
  constructor() {
    super(`Puedes tener hasta ${MAX_SUPPLEMENTS} suplementos`);
  }
}

export abstract class SupplementRepository {
  /** Active supplements of a user, in display order. */
  abstract listActive(userId: string): Promise<Supplement[]>;
  abstract countActive(userId: string): Promise<number>;
  /** Whether the user ever had a supplement (archived included): defaults are seeded only once. */
  abstract hasAny(userId: string): Promise<boolean>;
  abstract create(input: { id: string; userId: string; name: string; sortOrder: number }): Promise<Supplement>;
  abstract findOwned(id: string, userId: string): Promise<Supplement | undefined>;
  abstract archive(id: string): Promise<void>;
  /** Days (`YYYY-MM-DD`) in `[from, to]` on which each supplement was taken. */
  abstract takenDays(supplementIds: string[], from: string, to: string): Promise<Map<string, string[]>>;
  abstract setTaken(supplementId: string, day: string, taken: boolean): Promise<void>;
}
