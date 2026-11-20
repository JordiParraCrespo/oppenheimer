import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBotSeenAt, useMarkBotSeen } from '../hooks/use-bot-seen';
import { isBotDone } from '../lib/bot-seen';

/**
 * A bot is done, and its sidebar row takes the blue dot, once it has stopped
 * working with a message the reader has not seen in its chat on this device;
 * opening the chat takes the dot off, and a message that lands while the chat
 * is open never lights it. A bot whose chat was never opened here counts as
 * seen from the device's first visit, so the dot does not light every bot that
 * ever spoke.
 */

afterEach(() => window.localStorage.clear());

const at = (ms: number) => new Date(ms);
const spoke = (ms: number) => ({ lastActivityAt: at(ms), lastMessagePreview: 'Done.' });

describe('a bot done with something unseen', () => {
  it('lights for a message newer than the reader last saw, never while it works, never for a silent bot', () => {
    expect(isBotDone(spoke(2_000), false, 1_000)).toBe(true);
    expect(isBotDone(spoke(2_000), true, 1_000)).toBe(false);
    expect(isBotDone(spoke(1_000), false, 1_000)).toBe(false);
    expect(isBotDone({ lastActivityAt: at(2_000), lastMessagePreview: null }, false, 1_000)).toBe(
      false,
    );
  });

  it("counts a bot whose chat this device never opened as seen from the device's first visit", () => {
    const row = renderHook(() => useBotSeenAt('b1'));
    const since = row.result.current;
    expect(Number.isFinite(since)).toBe(true);
    expect(isBotDone(spoke(since - 60_000), false, since)).toBe(false);
    expect(isBotDone(spoke(since + 60_000), false, since)).toBe(true);
  });

  it('takes the dot off when the chat is opened, and keeps it off as the open chat moves on', () => {
    const row = renderHook(() => useBotSeenAt('b1'));
    const since = row.result.current;
    const chat = renderHook(({ last }) => useMarkBotSeen('b1', at(last)), {
      initialProps: { last: since + 60_000 },
    });
    expect(row.result.current).toBe(since + 60_000);

    chat.rerender({ last: since + 120_000 });
    expect(isBotDone(spoke(since + 120_000), false, row.result.current)).toBe(false);
  });
});
