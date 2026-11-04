import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStartLogStalled } from '../hooks/use-start-log-stalled';
import type { StartLogReadState } from '../lib/start-log-stall';

/**
 * The start pane polls the session's log while it starts. One failed read
 * with a working one a tick later must not put "Could not reach the server"
 * over a stepper that keeps advancing (it did, on most starts over a flaky
 * link); reads that keep failing must still say so, even when no further read
 * comes (the workspace stream stands the poll down). A regression that showed
 * every failed read brings the false alarm back; one that waited for another
 * read to notice the grace ran out hides a real outage.
 */
const STALL_MS = CONSUMER_CONFIG.sessions.startLogStallMs;
const error = new Error('Failed to fetch');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

function mount(read: StartLogReadState) {
  return renderHook((props: StartLogReadState) => useStartLogStalled(props), {
    initialProps: read,
  });
}

describe('useStartLogStalled', () => {
  it('stays quiet when nothing failed', () => {
    const { result } = mount({ error: null, dataUpdatedAt: 0 });
    act(() => vi.advanceTimersByTime(STALL_MS * 2));
    expect(result.current).toBe(false);
  });

  it('stays quiet for a failure the next good read clears within the grace', () => {
    const { result, rerender } = mount({ error, dataUpdatedAt: 0 });
    act(() => vi.advanceTimersByTime(STALL_MS - 1000));
    rerender({ error: null, dataUpdatedAt: Date.now() });
    act(() => vi.advanceTimersByTime(STALL_MS));
    expect(result.current).toBe(false);
  });

  it('speaks once the grace runs out, with no further read to prompt it', () => {
    // The create seeds the log with `updatedAt: 0`: the grace counts from mount.
    const { result } = mount({ error, dataUpdatedAt: 0 });
    act(() => vi.advanceTimersByTime(STALL_MS - 1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('counts the grace from the last good read', () => {
    const { result, rerender } = mount({ error: null, dataUpdatedAt: 0 });
    act(() => vi.advanceTimersByTime(10_000));
    const lastGood = Date.now();
    rerender({ error, dataUpdatedAt: lastGood });
    act(() => vi.advanceTimersByTime(STALL_MS - 1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });
});
