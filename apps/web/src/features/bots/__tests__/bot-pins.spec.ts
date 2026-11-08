import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { storedList } from '@oppenheimer/frontend-web';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBotPins } from '../hooks/use-bot-pins';
import { groupIdOf, inOrder } from '../lib/bot-groups';
import {
  BOT_PINS_KEY,
  botDrop,
  PINNED_BOTS,
  placedBotPins,
  positionInGroup,
  splitPinnedBots,
} from '../lib/bot-pins';

/**
 * A pinned bot comes back pinned on the next visit, on top of the ones
 * pinned before it, and is drawn once: under Pinned, never in its group too.
 */

const bot = (id: string, name = id) => ({ id, name }) as BotEntity;
const inGroup = (id: string, position: number, groupId: string | null = 'g') =>
  ({ id, name: id, groupId, position }) as BotEntity;
const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id);

afterEach(() => window.localStorage.clear());

describe('useBotPins', () => {
  it('keeps a pin across a reload, the latest on top, and forgets an unpin', () => {
    const first = renderHook(() => useBotPins());
    act(() => first.result.current.setPinned('b1', true));
    act(() => first.result.current.setPinned('b2', true));
    first.unmount();

    const second = renderHook(() => useBotPins());
    expect(second.result.current.pins).toEqual(['b2', 'b1']);
    act(() => second.result.current.setPinned('b2', false));
    expect(storedList(BOT_PINS_KEY)).toEqual(['b1']);
  });

  it('re-pins in the order a drop on Pinned left', () => {
    const { result } = renderHook(() => useBotPins());
    act(() => result.current.setPinned('b1', true));
    act(() => result.current.setPinned('b2', true));
    act(() => result.current.placePins(['b1', 'b3', 'b2']));
    expect(result.current.pins).toEqual(['b1', 'b3', 'b2']);
  });
});

describe('placedBotPins', () => {
  it('keeps a pin the drop did not see after the ones it placed', () => {
    expect(placedBotPins(['b', 'a'], ['a', 'unread', 'b'])).toEqual(['b', 'a', 'unread']);
  });
});

describe('splitPinnedBots', () => {
  it('draws the pinned in pin order and leaves them out of the rest, skipping a deleted pin', () => {
    const { pinned, rest } = splitPinnedBots(
      [bot('a'), bot('b'), bot('c'), bot('d')],
      ['c', 'gone', 'a'],
      '',
    );
    expect(idsOf(pinned)).toEqual(['c', 'a']);
    expect(idsOf(rest)).toEqual(['b', 'd']);
  });

  it('narrows the pinned by the search, and never draws a pinned one in its group', () => {
    const { pinned, rest } = splitPinnedBots(
      [bot('a', 'Pullpo'), bot('b', 'Alfred'), bot('c', 'Pulse')],
      ['a', 'b'],
      'pul',
    );
    expect(idsOf(pinned)).toEqual(['a']);
    expect(idsOf(rest)).toEqual(['c']);
  });
});

describe('positionInGroup', () => {
  // Group g holds A, P (pinned, so not drawn there) and B.
  const all = [inGroup('A', 0), inGroup('P', 1), inGroup('B', 2)];

  it('saves a bot dragged below its neighbour after it, past the pinned bot it does not draw', () => {
    // Drawn [A, B], A dragged below B: the API must hear [P, B, A], not [P, A, B].
    expect(positionInGroup(all, 'g', ['B', 'A'], 'A')).toBe(2);
  });

  it('saves a bot dropped at the end of a group after its last drawn row', () => {
    expect(positionInGroup([...all, inGroup('C', 0, null)], 'g', ['A', 'B', 'C'], 'C')).toBe(3);
  });

  it('saves a bot dropped at the top before the first drawn row', () => {
    expect(positionInGroup(all, 'g', ['B', 'A'], 'B')).toBe(0);
  });

  it('saves a bot dropped in an empty group at its start', () => {
    expect(positionInGroup(all, 'empty', ['A'], 'A')).toBe(0);
  });
});

describe('botDrop', () => {
  const all = [inGroup('A', 0), inGroup('P', 1), inGroup('B', 2)];

  it('only re-pins, in the order left, when a bot lands on Pinned', () => {
    const drop = botDrop(
      { id: 'A', from: 'g', to: PINNED_BOTS },
      { [PINNED_BOTS]: ['P', 'A'] },
      all,
      groupIdOf,
    );
    expect(drop).toEqual({ kind: 'pins', pins: ['P', 'A'] });
  });

  it('unpins a bot dragged out of Pinned and saves it after the row it lands under', () => {
    const drop = botDrop(
      { id: 'P', from: PINNED_BOTS, to: 'g' },
      { g: ['A', 'B', 'P'] },
      all,
      groupIdOf,
    );
    expect(drop).toEqual({ kind: 'move', unpin: true, groupId: 'g', position: 2 });
  });

  it('keeps the pin of a bot moved between groups, and names Ungrouped as no group', () => {
    const drop = botDrop(
      { id: 'A', from: 'g', to: 'ungrouped' },
      { ungrouped: ['A'] },
      all,
      groupIdOf,
    );
    expect(drop).toEqual({ kind: 'move', unpin: false, groupId: null, position: 0 });
  });
});

describe('inOrder with the pinned bots', () => {
  it('draws a bot the held order took out of Pinned in the group it was dragged to, once', () => {
    const sections = [{ id: 'g', group: null, bots: [inGroup('A', 0), inGroup('B', 2)] }];
    const drawn = inOrder(sections, { g: ['A', 'P', 'B'], [PINNED_BOTS]: [] }, [inGroup('P', 1)]);
    expect(idsOf(drawn[0]?.bots ?? [])).toEqual(['A', 'P', 'B']);
  });
});
