import { describe, expect, it } from 'vitest';
import { loopCadenceOf } from '../lib/loop-cadence';

/**
 * How the console words a loop's interval (`25-bots.md` §4.1, `/loop`). What
 * breaks this: "every 120 minutes" where the person typed 2h, or a
 * self-paced loop drawn as running every 0 minutes.
 */
describe('loopCadenceOf', () => {
  it('words an interval in the largest whole unit it is in', () => {
    expect(loopCadenceOf(5)).toEqual({ key: 'bots.chat.loop.every.minutes', count: 5 });
    expect(loopCadenceOf(90)).toEqual({ key: 'bots.chat.loop.every.minutes', count: 90 });
    expect(loopCadenceOf(120)).toEqual({ key: 'bots.chat.loop.every.hours', count: 2 });
    expect(loopCadenceOf(1_440)).toEqual({ key: 'bots.chat.loop.every.days', count: 1 });
  });

  it('says a loop with no interval runs when the bot chooses', () => {
    expect(loopCadenceOf(null).key).toBe('bots.chat.loop.every.selfPaced');
  });
});
