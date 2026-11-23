import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReadBotOnOpen } from '../hooks/use-read-bot-on-open';

/**
 * The open chat is read on the API, so its blue dot (and a failed turn's
 * amber one) goes on every device, as an open session's report is: once per
 * new message, never again for the same one, and not for a bot with nothing
 * to read.
 */

const api = vi.hoisted(() => ({ acknowledge: vi.fn(), waiting: false }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useAcknowledgeBot: () => ({ mutate: api.acknowledge }),
  useBotWaitingOnYou: () => api.waiting,
}));

afterEach(() => {
  api.acknowledge.mockReset();
  api.waiting = false;
});

const at = (ms: number) => new Date(ms);

describe('reading a bot’s chat on open', () => {
  it('reads an unread bot once per message, and a read one never', () => {
    const chat = renderHook((bot) => useReadBotOnOpen(bot), {
      initialProps: { id: 'b1', unread: false, lastActivityAt: at(1_000) },
    });
    expect(api.acknowledge).not.toHaveBeenCalled();

    chat.rerender({ id: 'b1', unread: true, lastActivityAt: at(2_000) });
    chat.rerender({ id: 'b1', unread: true, lastActivityAt: at(2_000) });
    expect(api.acknowledge).toHaveBeenCalledTimes(1);
    expect(api.acknowledge).toHaveBeenCalledWith('b1');

    chat.rerender({ id: 'b1', unread: true, lastActivityAt: at(3_000) });
    expect(api.acknowledge).toHaveBeenCalledTimes(2);
  });

  it('reads a bot that waits on you, so a failed turn’s amber dot goes', () => {
    api.waiting = true;
    renderHook(() => useReadBotOnOpen({ id: 'b1', unread: false, lastActivityAt: at(1_000) }));
    expect(api.acknowledge).toHaveBeenCalledWith('b1');
  });
});
