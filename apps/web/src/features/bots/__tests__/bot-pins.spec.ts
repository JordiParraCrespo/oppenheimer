import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { storedList } from '@oppenheimer/frontend-web';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBotPins } from '../hooks/use-bot-pins';
import { BOT_PINS_KEY, placedBotPins, splitPinnedBots } from '../lib/bot-pins';

/**
 * A pinned bot comes back pinned on the next visit, on top of the ones
 * pinned before it, and is drawn once: under Pinned, never in its group too.
 */

const bot = (id: string, name = id) => ({ id, name }) as BotEntity;
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
