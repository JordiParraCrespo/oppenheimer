import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadOnStaleBuild, type StaleBuildWindow } from './stale-build-reload';

/**
 * A tab opened before a deploy asks for chunks the deploy removed. Without the
 * reload, the row menu's Delete threw into the session list's boundary and
 * emptied it under "Could not reach the server"; with a reload on every
 * failure, a chunk that is really gone would reload the page for ever; and
 * with the failure swallowed, the import resolved to nothing and the router
 * crashed on it before the reload landed.
 */
function fakeWindow({ storageRefused = false } = {}) {
  const target = new EventTarget();
  const stored = new Map<string, string>();
  const reload = vi.fn();
  const refuse = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  const win: StaleBuildWindow = {
    addEventListener: target.addEventListener.bind(target),
    sessionStorage: storageRefused
      ? { getItem: refuse, setItem: refuse }
      : {
          getItem: (key) => stored.get(key) ?? null,
          setItem: (key, value) => void stored.set(key, value),
        },
    location: { reload },
  };
  const fail = () => {
    const event = new Event('vite:preloadError', { cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  /**
   * A route's lazy `import()` as a Vite build compiles it: on a failure the
   * helper fires `vite:preloadError` and rethrows only when nobody cancelled
   * the event; a cancelled one resolves the import to `undefined`.
   */
  const importStaleChunk = async (): Promise<{ component: unknown } | undefined> => {
    const failure = new TypeError(
      'Failed to fetch dynamically imported module: https://console.test/assets/bots.queries-BAiNbrnn.js',
    );
    const event = new Event('vite:preloadError', { cancelable: true });
    target.dispatchEvent(event);
    if (!event.defaultPrevented) throw failure;
    return undefined;
  };
  return { win, reload, fail, importStaleChunk };
}

describe('reloadOnStaleBuild', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reloads on a chunk that failed to load', () => {
    const { win, reload, fail } = fakeWindow();
    reloadOnStaleBuild(win);
    fail();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('lets the import reject with the loader error while the reload is on its way', async () => {
    // Cancelling the event made the import resolve to nothing, and the router
    // threw "Cannot read properties of undefined (reading 'component')" before
    // the page went (Sentry OPPENHEIMER-WEB-4).
    const { win, reload, importStaleChunk } = fakeWindow();
    reloadOnStaleBuild(win);
    await expect(importStaleChunk()).rejects.toThrow(/Failed to fetch dynamically imported module/);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('lets a second failure right after a reload through, instead of looping', () => {
    const { win, reload, fail } = fakeWindow();
    reloadOnStaleBuild(win);
    fail();
    vi.advanceTimersByTime(2_000);
    fail();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('never reloads when storage refuses the guard, which would loop on a chunk every load asks for', () => {
    const { win, reload, fail } = fakeWindow({ storageRefused: true });
    reloadOnStaleBuild(win);
    fail();
    expect(reload).not.toHaveBeenCalled();
  });

  it('restarts the quiet window on every failure, so a burst reloads once', () => {
    const { win, reload, fail } = fakeWindow();
    reloadOnStaleBuild(win);
    fail();
    vi.advanceTimersByTime(8_000);
    fail();
    vi.advanceTimersByTime(8_000);
    fail();
    expect(reload).toHaveBeenCalledOnce();
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
