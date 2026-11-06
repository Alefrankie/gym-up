import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { newLogAttempt, sendLogAttempt } from './recipes';

describe('Añadir a hoy', () => {
  it('retries the same entry when the response to the first send was lost', async () => {
    const sent: Array<{ id: string; servings: number }> = [];
    const attempt = newLogAttempt();
    attempt.servings = 1.5;

    await sendLogAttempt(attempt, async (body) => void sent.push(body));
    // The write landed but the answer never arrived, so the member taps again.
    await sendLogAttempt(attempt, async (body) => void sent.push(body));

    expect(sent[0]).toEqual({ id: attempt.entryId, servings: 1.5 });
    expect(sent[1]).toEqual(sent[0]);
  });

  it('mints a new entry for a new attempt, so logging twice on purpose still logs twice', async () => {
    expect(newLogAttempt().entryId).not.toBe(newLogAttempt().entryId);
  });
});
