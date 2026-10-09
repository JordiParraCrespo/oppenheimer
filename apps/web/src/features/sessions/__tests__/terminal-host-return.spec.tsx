import type { SessionStream, StreamStatus } from '@oppenheimer/frontend-consumer';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminal } from '../hooks/use-terminal';
import { clearTerminals } from '../lib/terminal-pool';

/**
 * A terminal told `host_offline` redials as soon as the host list finds the
 * host online, rather than sitting out the ladder's thirty-second rung. Only a
 * list answered after the link went offline counts: the read from before it
 * still called the host online, and redialling on it would meet `host_offline`
 * again. The API keeps a host online for thirty seconds after its last
 * heartbeat, so a runner restarted inside that window never reads offline,
 * and an offline→online edge would never fire for it.
 */

vi.mock('../lib/terminal-runtime', () => ({
  mountSessionTerminal: () => ({
    hasOutput: false,
    serialize: () => '',
    shown: () => {},
    dispose: () => {},
  }),
}));
vi.mock('@oppenheimer/frontend-core/react', () => ({
  useOppenheimerApp: () => ({ auth: { store: { subscribe: () => () => {} } } }),
}));

let presence: { data?: { name: string; online: boolean }; dataUpdatedAt: number };
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useHostPresence: () => presence,
}));

function fakeStream() {
  const statusListeners = new Set<(status: StreamStatus) => void>();
  let current: StreamStatus = 'connecting';
  const stream = {
    onData: () => () => {},
    onEnd: () => () => {},
    onStatus: (listener: (status: StreamStatus) => void) => {
      listener(current);
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    send: () => {},
    resize: () => {},
    reconnectNow: vi.fn(),
    dispose: () => {},
  } satisfies SessionStream;
  const emit = (next: StreamStatus) => {
    current = next;
    for (const listener of statusListeners) listener(next);
  };
  return { stream, emit };
}

function mount() {
  const { stream, emit } = fakeStream();
  const createStream = () => stream;
  const container = document.createElement('div');
  const hook = renderHook(() => {
    const terminal = useTerminal('s-1:0', createStream, { hostId: 'h-1' });
    // The ref a component would attach, in place before the mount effect runs.
    terminal.containerRef.current = container;
    return terminal;
  });
  return { ...hook, stream, emit };
}

describe('useTerminal while its host is offline', () => {
  beforeEach(() => {
    presence = { data: { name: 'laptop', online: true }, dataUpdatedAt: 1 };
  });
  // The pool outlives a render; each test starts with no kept terminal.
  afterEach(() => clearTerminals());

  it('does not redial on the list read from before the link went offline', () => {
    const { stream, emit, rerender } = mount();
    act(() => emit('offline'));
    rerender();
    expect(stream.reconnectNow).not.toHaveBeenCalled();
  });

  it('redials when a later poll finds the host online, even if it never read offline', () => {
    const { stream, emit, rerender, result } = mount();
    act(() => emit('offline'));
    expect(result.current.hostName).toBe('laptop');

    presence = { data: { name: 'laptop', online: true }, dataUpdatedAt: Date.now() + 1000 };
    rerender();
    rerender();
    expect(stream.reconnectNow).toHaveBeenCalledTimes(1);
  });

  it('does not redial while the list still says offline', () => {
    const { stream, emit, rerender } = mount();
    act(() => emit('offline'));
    presence = { data: { name: 'laptop', online: false }, dataUpdatedAt: Date.now() + 1000 };
    rerender();
    expect(stream.reconnectNow).not.toHaveBeenCalled();
  });
});
