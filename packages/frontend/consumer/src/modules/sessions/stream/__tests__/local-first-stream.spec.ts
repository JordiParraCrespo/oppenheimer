import { describe, expect, it, vi } from 'vitest';
import { LocalFirstSessionStream, type LocalTerminals } from '../local-first-stream';
import type { SessionStream, StreamPath, StreamStatus } from '../session-stream';

/**
 * Local first, the relay otherwise: which path a session takes from what this
 * machine's runner holds, the credit a drained chunk sends back, the fall back
 * when the local attachment closes, and listeners that leave on time whichever
 * path won.
 */

function fakeTerminals(holds: boolean) {
  const data = new Map<number, (chunk: Uint8Array) => void>();
  const close = new Map<number, () => void>();
  const terminals: LocalTerminals & { credited: number[]; written: string[] } = {
    credited: [],
    written: [],
    hasSession: vi.fn(async () => holds),
    attach: vi.fn(async () => 7),
    write: (_h, d) => terminals.written.push(d),
    resize: vi.fn(),
    credit: (_h, bytes) => terminals.credited.push(bytes),
    close: vi.fn(),
    onData: (h, l) => {
      data.set(h, l);
      return () => data.delete(h);
    },
    onClose: (h, l) => {
      close.set(h, l);
      return () => close.delete(h);
    },
  };
  return {
    terminals,
    emit: (chunk: Uint8Array) => data.get(7)?.(chunk),
    closeLocal: () => close.get(7)?.(),
  };
}

function fakeRemote() {
  const data = new Set<(chunk: Uint8Array | string, consumed: () => void) => void>();
  const remote: SessionStream & { sent: string[] } = {
    sent: [],
    onData: (l) => {
      data.add(l);
      return () => data.delete(l);
    },
    onEnd: () => () => {},
    onStatus: (l: (s: StreamStatus) => void) => {
      l('live');
      return () => {};
    },
    send: (d) => remote.sent.push(d),
    resize: vi.fn(),
    reconnectNow: vi.fn(),
    dispose: vi.fn(),
  };
  const emit = (chunk: string) => {
    for (const l of data) l(chunk, () => {});
  };
  return { remote, emit };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('LocalFirstSessionStream', () => {
  it('attaches locally when this machine holds the session, and credits each drained chunk once', async () => {
    const local = fakeTerminals(true);
    const factory = vi.fn(() => fakeRemote().remote);
    const stream = new LocalFirstSessionStream(local.terminals, 's1', 0, factory);
    const paths: StreamPath[] = [];
    stream.onPath((p) => paths.push(p));
    const seen: number[] = [];
    stream.onData((chunk, consumed) => {
      seen.push((chunk as Uint8Array).byteLength);
      consumed();
      consumed();
    });
    await settle();

    local.emit(new Uint8Array(5));
    stream.send('ls\r');

    expect(paths).toEqual(['local']);
    expect(seen).toEqual([5]);
    expect(local.terminals.credited).toEqual([5]);
    expect(local.terminals.written).toEqual(['ls\r']);
    expect(factory).not.toHaveBeenCalled();
  });

  it('takes the relay when this machine does not hold the session', async () => {
    const local = fakeTerminals(false);
    const { remote, emit } = fakeRemote();
    const stream = new LocalFirstSessionStream(local.terminals, 's1', 0, () => remote);
    const seen: unknown[] = [];
    stream.onData((chunk) => seen.push(chunk));
    await settle();

    emit('hello');
    stream.send('x');

    expect(seen).toEqual(['hello']);
    expect(remote.sent).toEqual(['x']);
    expect(local.terminals.attach).not.toHaveBeenCalled();
  });

  it('falls back to the relay when the local attachment closes', async () => {
    const local = fakeTerminals(true);
    const { remote, emit } = fakeRemote();
    const stream = new LocalFirstSessionStream(local.terminals, 's1', 0, () => remote);
    const seen: unknown[] = [];
    stream.onData((chunk) => seen.push(chunk));
    await settle();

    local.closeLocal();
    emit('after');
    stream.send('y');

    expect(seen).toEqual(['after']);
    expect(remote.sent).toEqual(['y']);
  });

  // The regression: a listener added before the choice and removed after it
  // stayed subscribed to the relay stream and kept receiving its bytes.
  it('stops delivering to a listener that unsubscribed before the relay was chosen', async () => {
    const local = fakeTerminals(false);
    const { remote, emit } = fakeRemote();
    const stream = new LocalFirstSessionStream(local.terminals, 's1', 0, () => remote);
    const seen: unknown[] = [];
    const off = stream.onData((chunk) => seen.push(chunk));
    await settle();

    off();
    emit('late');

    expect(seen).toEqual([]);
  });
});
