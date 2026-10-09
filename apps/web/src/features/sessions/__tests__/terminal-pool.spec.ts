import type { SessionStream, StreamEnd } from '@oppenheimer/frontend-consumer';
import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  claimTerminal,
  clearTerminals,
  clearTerminalsOnSignOut,
  isTerminalWarm,
} from '../lib/terminal-pool';

/**
 * Moving between sessions must not cost a new socket, a new attachment and a
 * blank pane each time. A terminal the reader leaves stays attached for a
 * while and comes back as it is; one that was closed leaves its last frame
 * for the next to draw while it dials. What must never happen: an ended
 * stream handed out again, or a terminal outliving the sign-out.
 */

/** What each mounted terminal was opened with, by key. */
const mounted: { key: string; restore?: string; disposed: boolean }[] = [];

vi.mock('../lib/terminal-runtime', () => ({
  mountSessionTerminal: (
    host: HTMLElement,
    _stream: SessionStream,
    options: { restore?: string },
  ) => {
    const record = { key: host.dataset.key ?? '', restore: options.restore, disposed: false };
    mounted.push(record);
    return {
      hasOutput: true,
      serialize: () => `frame of ${record.key}`,
      shown: () => {},
      dispose: () => {
        record.disposed = true;
      },
    };
  },
}));

function fakeStream() {
  const endListeners = new Set<(reason: StreamEnd) => void>();
  const stream = {
    onData: () => () => {},
    onEnd: (listener: (reason: StreamEnd) => void) => {
      endListeners.add(listener);
      return () => endListeners.delete(listener);
    },
    onStatus: () => () => {},
    send: () => {},
    resize: () => {},
    reconnectNow: () => {},
    dispose: vi.fn(),
  } satisfies SessionStream;
  const end = (reason: StreamEnd) => {
    for (const listener of endListeners) listener(reason);
  };
  return { stream, end };
}

/** Shows `key` in a fresh pane, the way the session screen does. */
function show(key: string) {
  const container = document.createElement('div');
  const fake = fakeStream();
  const createStream = vi.fn(() => {
    // `claimTerminal` puts its element in the pane before it opens the
    // stream; the fake terminal reads which session it is for off it.
    const host = container.firstElementChild as HTMLElement | null;
    if (host) host.dataset.key = key;
    return fake.stream;
  });
  const onFirstOutput = vi.fn();
  const claim = claimTerminal(
    key,
    container,
    createStream,
    { onFirstOutput },
    { agentWindow: true },
  );
  return { claim, container, createStream, onFirstOutput, ...fake };
}

describe('the terminal pool', () => {
  afterEach(() => {
    clearTerminals();
    mounted.length = 0;
  });

  it('gives back the terminal the reader left, without dialling again', () => {
    const first = show('s-1:0');
    first.claim.release();
    expect(isTerminalWarm('s-1:0')).toBe(true);

    const again = show('s-1:0');
    expect(again.createStream).not.toHaveBeenCalled();
    expect(again.claim.stream).toBe(first.stream);
    // The same element, moved into the new pane, and already drawn.
    expect(again.container.firstElementChild).not.toBeNull();
    expect(first.container.firstElementChild).toBeNull();
    expect(again.onFirstOutput).toHaveBeenCalled();
  });

  it('closes the oldest terminal past the warm count and keeps its last frame', () => {
    const warm = CONSUMER_CONFIG.stream.warmTerminals;
    const shown = Array.from({ length: warm + 1 }, (_, i) => show(`s-${i}:0`));
    for (const pane of shown) pane.claim.release();

    expect(isTerminalWarm('s-0:0')).toBe(false);
    expect(shown[0]?.stream.dispose).toHaveBeenCalled();
    expect(isTerminalWarm(`s-${warm}:0`)).toBe(true);

    // The next terminal for it opens on the frame it left, while it dials.
    const back = show('s-0:0');
    expect(back.createStream).toHaveBeenCalledTimes(1);
    expect(mounted.at(-1)?.restore).toBe('frame of s-0:0');
  });

  it('closes a terminal left too long, keeping its frame', () => {
    vi.useFakeTimers();
    try {
      show('s-1:0').claim.release();
      vi.advanceTimersByTime(CONSUMER_CONFIG.stream.warmForMs);
      expect(isTerminalWarm('s-1:0')).toBe(false);
      show('s-1:0');
      expect(mounted.at(-1)?.restore).toBe('frame of s-1:0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('never hands out an ended stream, and keeps no frame of it', () => {
    const pane = show('s-1:0');
    pane.end('stopped');
    pane.claim.release();
    expect(isTerminalWarm('s-1:0')).toBe(false);

    const next = show('s-1:0');
    expect(next.createStream).toHaveBeenCalledTimes(1);
    expect(mounted.at(-1)?.restore).toBeUndefined();
  });

  it('closes a parked terminal whose stream ends while nobody looks', () => {
    const pane = show('s-1:0');
    pane.claim.release();
    pane.end('stopped');
    expect(isTerminalWarm('s-1:0')).toBe(false);
    expect(pane.stream.dispose).toHaveBeenCalled();
  });

  it('closes everything, frames included, when the sign-in ends', () => {
    let notify: (state: { isAuthenticated: boolean }) => void = () => {};
    clearTerminalsOnSignOut({
      subscribe: (listener) => {
        notify = listener;
        return () => {};
      },
    });
    const shown = show('s-1:0');
    const left = show('s-2:0');
    left.claim.release();

    notify({ isAuthenticated: false });

    expect(isTerminalWarm('s-1:0')).toBe(false);
    expect(isTerminalWarm('s-2:0')).toBe(false);
    expect(shown.stream.dispose).toHaveBeenCalled();
    expect(left.stream.dispose).toHaveBeenCalled();
    show('s-2:0');
    expect(mounted.at(-1)?.restore).toBeUndefined();
  });
});
