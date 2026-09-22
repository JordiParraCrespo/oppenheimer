import { ATTACH_CLOSE_CODES } from '@oppenheimer/shared/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachSocketUrl,
  createSessionStream,
  type SessionStream,
  type StreamStatus,
} from '../lib/session-stream';

/**
 * The real transport against a scripted socket: the contract `use-terminal`
 * relies on (status first, bytes through, keystrokes out, dispose stops all)
 * plus what the wire decides — the viewport before the attach, a fresh ticket
 * per socket, the ladder on a drop and no ladder after a final refusal.
 */

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  readonly sent: (string | Uint8Array)[] = [];
  readyState = FakeSocket.CONNECTING;
  binaryType = 'blob';
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed: { code: number; reason?: string } | null = null;

  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {}

  send(data: string | Uint8Array) {
    this.sent.push(data);
  }

  close(code: number, reason?: string) {
    this.closed = { code, reason };
    this.readyState = 3;
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  text(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  bytes(text: string) {
    this.onmessage?.({ data: new TextEncoder().encode(text).buffer });
  }

  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }

  controls(): unknown[] {
    return this.sent
      .filter((item): item is string => typeof item === 'string')
      .map((s) => JSON.parse(s));
  }
}

interface Harness {
  stream: SessionStream;
  sockets: FakeSocket[];
  statuses: StreamStatus[];
  chunks: string[];
  ends: string[];
  tickets: ReturnType<typeof vi.fn>;
  timers: { fn: () => void; ms: number }[];
  flush(): Promise<void>;
}

function harness(
  overrides: { issueTicket?: () => Promise<{ ticket: string; url: string }> } = {},
): Harness {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  let minted = 0;
  const tickets = vi.fn(
    overrides.issueTicket ??
      (async () => {
        minted += 1;
        return { ticket: `t-${minted}`, url: '/api/v1/relay/attach' };
      }),
  );
  const stream = createSessionStream({
    issueTicket: tickets,
    apiBaseUrl: 'https://api.example.com',
    socketFactory: (url, protocols) => {
      const socket = new FakeSocket(url, protocols);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    schedule: (fn, ms) => {
      const timer = { fn, ms };
      timers.push(timer);
      return () => timers.splice(timers.indexOf(timer), 1);
    },
  });
  const statuses: StreamStatus[] = [];
  const chunks: string[] = [];
  stream.onStatus((status) => statuses.push(status));
  const ends: string[] = [];
  stream.onEnd((reason) => ends.push(reason));
  stream.onData((chunk, consumed) => {
    chunks.push(new TextDecoder().decode(chunk as Uint8Array));
    consumed();
  });
  return {
    stream,
    sockets,
    statuses,
    chunks,
    ends,
    tickets,
    timers,
    // The ticket is awaited before the socket is made; two ticks settle it.
    flush: async () => {
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket);
});

describe('attachSocketUrl', () => {
  it('puts the ticket path on the API origin with the socket scheme', () => {
    expect(attachSocketUrl('/api/v1/relay/attach', 'https://api.example.com')).toBe(
      'wss://api.example.com/api/v1/relay/attach',
    );
    expect(attachSocketUrl('/api/v1/relay/attach', 'http://localhost:3001')).toBe(
      'ws://localhost:3001/api/v1/relay/attach',
    );
  });
});

describe('createSessionStream', () => {
  it('mints a ticket, opens the socket with it as the subprotocol, and sends the viewport first', async () => {
    const h = harness();
    expect(h.statuses).toEqual(['connecting']);
    h.stream.resize(120, 40);
    await h.flush();
    expect(h.sockets).toHaveLength(1);
    const socket = h.sockets[0];
    expect(socket.url).toBe('wss://api.example.com/api/v1/relay/attach');
    expect(socket.protocols).toEqual(['t-1']);
    expect(socket.binaryType).toBe('arraybuffer');
    socket.open();
    expect(socket.controls()).toEqual([{ type: 'resize', cols: 120, rows: 40 }]);
  });

  it('credits only what the terminal consumed, and only once attached', async () => {
    const h = harness();
    await h.flush();
    const socket = h.sockets[0];
    socket.open();
    // Before attach: bytes are delivered but no credit leaves, whatever the terminal says.
    socket.bytes('early');
    expect(h.chunks).toEqual(['early']);
    expect(socket.controls()).not.toContainEqual(expect.objectContaining({ type: 'credit' }));
    socket.text({ type: 'attached', window: 0 });
    socket.bytes('later');
    expect(socket.controls()).toContainEqual({ type: 'credit', bytes: 5 });
  });

  it('goes live on attached, delivers bytes, credits them, and sends keystrokes as bytes', async () => {
    const h = harness();
    await h.flush();
    const socket = h.sockets[0];
    socket.open();
    socket.text({ type: 'attached', window: 0 });
    expect(h.statuses).toEqual(['connecting', 'live']);

    socket.bytes('$ claude\r\n');
    expect(h.chunks).toEqual(['$ claude\r\n']);
    expect(socket.controls()).toContainEqual({ type: 'credit', bytes: 10 });

    h.stream.send('ls\r');
    const last = socket.sent.at(-1);
    // Bytes, not a string: the relay forwards a binary frame as keystrokes.
    expect(typeof last).not.toBe('string');
    expect(new TextDecoder().decode(last as Uint8Array)).toBe('ls\r');
  });

  it('holds keystrokes until attached, so nothing is typed at a pane that is not there', async () => {
    const h = harness();
    await h.flush();
    const socket = h.sockets[0];
    socket.open();
    h.stream.send('x');
    expect(socket.sent).toEqual([]);
  });

  it('reports offline on the hint and reconnects with a fresh ticket through the ladder', async () => {
    const h = harness();
    await h.flush();
    const first = h.sockets[0];
    first.open();
    first.text({ type: 'hint', kind: 'host_offline' });
    expect(h.statuses.at(-1)).toBe('offline');
    first.drop(ATTACH_CLOSE_CODES.HOST_OFFLINE);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBeGreaterThanOrEqual(400);
    expect(h.timers[0].ms).toBeLessThanOrEqual(600);

    h.timers[0].fn();
    await h.flush();
    expect(h.tickets).toHaveBeenCalledTimes(2);
    expect(h.sockets).toHaveLength(2);
    expect(h.sockets[1].protocols).toEqual(['t-2']);
    h.sockets[1].open();
    h.sockets[1].text({ type: 'attached', window: 0 });
    expect(h.statuses.at(-1)).toBe('live');
  });

  it('drops frames from a socket that has since been replaced', async () => {
    const h = harness();
    await h.flush();
    const first = h.sockets[0];
    first.open();
    first.drop(ATTACH_CLOSE_CODES.LINK_LOST);
    h.timers[0].fn();
    await h.flush();
    // The old socket's late frame is from an older epoch.
    first.bytes('stale');
    expect(h.chunks).toEqual([]);
  });

  it('stops after a final refusal rather than redeeming tickets forever', async () => {
    const h = harness();
    await h.flush();
    const socket = h.sockets[0];
    socket.open();
    socket.text({ type: 'refused', code: 'SESS_003', detail: 'stopped' });
    socket.drop(ATTACH_CLOSE_CODES.REFUSED);
    expect(h.statuses.at(-1)).toBe('closed');
    expect(h.ends).toEqual(['refused']);
    expect(h.timers).toHaveLength(0);
    expect(h.tickets).toHaveBeenCalledTimes(1);
  });

  it('ends with the reason the relay named on the socket, so a stop is not a ladder', async () => {
    const h = harness();
    await h.flush();
    const socket = h.sockets[0];
    socket.open();
    socket.text({ type: 'closed', reason: 'stopped' });
    socket.drop(ATTACH_CLOSE_CODES.SESSION_STOPPED);
    expect(h.ends).toEqual(['stopped']);
    expect(h.statuses.at(-1)).toBe('closed');
    expect(h.timers).toHaveLength(0);
  });

  it('retries when the API cannot be reached to mint a ticket, and never says offline', async () => {
    let calls = 0;
    const h = harness({
      issueTicket: async () => {
        calls += 1;
        if (calls === 1) throw new Error('network');
        return { ticket: 'late', url: '/api/v1/relay/attach' };
      },
    });
    await h.flush();
    expect(h.sockets).toHaveLength(0);
    expect(h.statuses).toEqual(['connecting']);
    h.timers[0].fn();
    await h.flush();
    expect(h.sockets[0].protocols).toEqual(['late']);
  });

  it('ends on a mint the API refused about this session, without a ladder', async () => {
    const h = harness({
      issueTicket: async () => {
        throw Object.assign(new Error('gone'), { status: 404 });
      },
    });
    await h.flush();
    expect(h.sockets).toHaveLength(0);
    expect(h.ends).toEqual(['missing']);
    expect(h.statuses.at(-1)).toBe('closed');
    expect(h.timers).toHaveLength(0);
  });

  it('closes the socket, cancels the retry and reports closed on dispose', async () => {
    const h = harness();
    await h.flush();
    const socket = h.sockets[0];
    socket.open();
    socket.text({ type: 'attached', window: 0 });
    h.stream.dispose();
    expect(socket.closed).toEqual({ code: 1000, reason: 'terminal closed' });
    expect(h.statuses.at(-1)).toBe('closed');
    // Nothing after dispose: not a late frame, not a reconnect.
    socket.bytes('late');
    expect(h.chunks).toEqual([]);
    expect(h.timers).toHaveLength(0);
  });
});
