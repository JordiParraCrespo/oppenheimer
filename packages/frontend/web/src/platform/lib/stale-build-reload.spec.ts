import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadOnStaleBuild, type StaleBuildWindow } from './stale-build-reload';

/**
 * A tab opened before a deploy asks for chunks the deploy removed. Without the
 * reload, the row menu's Delete threw into the session list's boundary and
 * emptied it under "Could not reach the server"; with a reload on every
 * failure, a chunk that is really gone would reload the page for ever.
 */
function fakeWindow() {
  const target = new EventTarget();
  const stored = new Map<string, string>();
  const reload = vi.fn();
  const win: StaleBuildWindow = {
    addEventListener: target.addEventListener.bind(target),
    sessionStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    } as Storage,
    location: { reload },
  };
  const fail = () => {
    const event = new Event('vite:preloadError', { cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  return { win, reload, fail };
}

describe('reloadOnStaleBuild', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reloads on a chunk that failed to load, and keeps the error from surfacing', () => {
    const { win, reload, fail } = fakeWindow();
    reloadOnStaleBuild(win);
    const event = fail();
    expect(reload).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets a second failure right after a reload through, instead of looping', () => {
    const { win, reload, fail } = fakeWindow();
    reloadOnStaleBuild(win);
    fail();
    vi.advanceTimersByTime(2_000);
    const again = fail();
    expect(reload).toHaveBeenCalledOnce();
    expect(again.defaultPrevented).toBe(false);
  });

  it('reloads again once the guard has passed', () => {
    const { win, reload, fail } = fakeWindow();
    reloadOnStaleBuild(win);
    fail();
    vi.advanceTimersByTime(60_000);
    fail();
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
