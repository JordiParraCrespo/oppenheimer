import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarkSeen } from '../hooks/use-mark-seen';

/**
 * The owner in a bot's chat, as the spend guard reads it (`26-bot-routines.md`
 * §6). The regressions this guards: a chat left open and in view whose
 * routines pause anyway, because what they said into it counted as unseen
 * (the chat only said so when it opened); and a chat in a background tab
 * counted as read.
 */

const state = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useMarkBotSeen: () => ({ mutate: state.mutate }),
}));

let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  state.mutate.mockReset();
});

describe('useMarkSeen', () => {
  it('says the owner is in the chat when it opens, and again every few minutes in view', () => {
    renderHook(() => useMarkSeen('bot-1'));
    expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.mutate).toHaveBeenCalledWith({ id: 'bot-1' });

    act(() => vi.advanceTimersByTime(5 * 60 * 1000));
    expect(state.mutate).toHaveBeenCalledTimes(2);
  });

  it('says nothing while the tab is hidden, and says it when the tab comes back', () => {
    visibility = 'hidden';
    renderHook(() => useMarkSeen('bot-1'));
    act(() => vi.advanceTimersByTime(15 * 60 * 1000));
    expect(state.mutate).not.toHaveBeenCalled();

    visibility = 'visible';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(state.mutate).toHaveBeenCalledTimes(1);
  });

  it('stops when the chat closes', () => {
    const { unmount } = renderHook(() => useMarkSeen('bot-1'));
    unmount();
    act(() => vi.advanceTimersByTime(15 * 60 * 1000));
    expect(state.mutate).toHaveBeenCalledTimes(1);
  });
});
