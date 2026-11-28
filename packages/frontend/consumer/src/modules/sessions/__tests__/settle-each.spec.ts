import { describe, expect, it } from 'vitest';
import { settleEach } from '../settle-each';

/**
 * Every bulk write over sessions (pin, move, Delete all, Hide all) settles
 * through one policy: each item is tried, a refusal does not stop the rest,
 * and at most four requests are in flight, so a group of a hundred does not
 * land on the API as one burst. A regression that ran them all at once, or
 * stopped at the first refusal, breaks it.
 */
describe('settleEach', () => {
  it('runs every action and hands back the ones that failed, in order, with the first reason', async () => {
    const refused = new Error('refused');
    const ran: string[] = [];
    const { failed, reason } = await settleEach(['a', 'b', 'c', 'd'], async (id) => {
      ran.push(id);
      if (id === 'b') throw refused;
      if (id === 'd') throw new Error('later');
    });
    expect([...ran].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(failed).toEqual(['b', 'd']);
    expect(reason).toBe(refused);
  });

  it('reports no reason when everything lands', async () => {
    expect(await settleEach(['a'], async () => {})).toEqual({ failed: [], reason: null });
  });

  it('keeps at most four in flight', async () => {
    let inFlight = 0;
    let most = 0;
    await settleEach(
      Array.from({ length: 12 }, (_, index) => index),
      async () => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 2));
        inFlight -= 1;
      },
    );
    expect(most).toBe(4);
  });

  it('turns a refusal that is not an Error into one', async () => {
    const { reason } = await settleEach(['a'], async () => {
      throw 'nope';
    });
    expect(reason).toBeInstanceOf(Error);
    expect(reason?.message).toBe('nope');
  });
});
