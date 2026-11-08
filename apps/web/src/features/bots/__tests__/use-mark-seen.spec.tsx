import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarkSeen } from '../hooks/use-mark-seen';

/**
 * The owner in a bot's chat, as the spend guard reads it (`26-bot-routines.md`
 * §6). The regressions this guards: routines that pause on an owner reading
 * the chat, because what they said while the owner read counted as unseen;
 * a tab left open overnight counted as a reader for good, so the routines
 * never stop; a chat in a background tab counted as read; and a write per
 * mouse move.
 */

const state = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useMarkBotSeen: () => ({ mutate: state.mutate }),
}));

let visibility: DocumentVisibilityState = 'visible';
const MINUTE = 60 * 1000;
const move = () => window.dispatchEvent(new Event('pointermove'));

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
  it('says the owner is in the chat when it opens', () => {
    renderHook(() => useMarkSeen('bot-1'));
    expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.mutate).toHaveBeenCalledWith({ id: 'bot-1' });
  });

  it('says it again while the owner is active, at most once a minute, and at the minute’s end', () => {
    renderHook(() => useMarkSeen('bot-1'));
    act(() => {
      vi.advanceTimersByTime(30 * 1000);
      move();
      window.dispatchEvent(new Event('keydown'));
    });
    expect(state.mutate).toHaveBeenCalledTimes(1);

    // The activity inside the minute is said when the minute ends, once.
    act(() => vi.advanceTimersByTime(30 * 1000));
    expect(state.mutate).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(5 * MINUTE));
    expect(state.mutate).toHaveBeenCalledTimes(2);

    act(() => move());
    expect(state.mutate).toHaveBeenCalledTimes(3);
  });

  it('counts a tab left open with nobody at it as nobody, however long it stays in view', () => {
    renderHook(() => useMarkSeen('bot-1'));
    act(() => vi.advanceTimersByTime(3 * 24 * 60 * MINUTE));
    expect(state.mutate).toHaveBeenCalledTimes(1);
  });

  it('says nothing from a hidden tab, and says it when the tab comes back', () => {
    visibility = 'hidden';
    renderHook(() => useMarkSeen('bot-1'));
    act(() => {
      vi.advanceTimersByTime(5 * MINUTE);
      move();
    });
    expect(state.mutate).not.toHaveBeenCalled();

    visibility = 'visible';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(state.mutate).toHaveBeenCalledTimes(1);
  });

  it('stops listening when the chat closes', () => {
    const { unmount } = renderHook(() => useMarkSeen('bot-1'));
    unmount();
    act(() => {
      vi.advanceTimersByTime(5 * MINUTE);
      move();
    });
    expect(state.mutate).toHaveBeenCalledTimes(1);
  });
});
