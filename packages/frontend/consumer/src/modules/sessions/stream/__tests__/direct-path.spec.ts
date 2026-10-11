import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DIRECT_CHANNEL_LABEL } from '../direct-path';
import { AttachSessionStream, type StreamPath } from '../session-stream';

/**
 * The direct path (`product/versions/mvp/22-direct-terminal-path.md`) against a
 * scripted socket and a scripted peer connection: what the stream promises the
 * terminal is the same bytes, in the same order, whichever path carried them,
 * and keystrokes reaching the host in the order they were typed.
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

  send(data: string | Uint8Array) {
    this.sent.push(data);
  }
  close() {
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
  controls(): { type: string; [key: string]: unknown }[] {
    return this.sent
      .filter((item): item is string => typeof item === 'string')
      .map((s) => JSON.parse(s));
  }
  typed(): string {
    return this.sent
      .filter((item): item is Uint8Array => typeof item !== 'string')
      .map((b) => new TextDecoder().decode(b))
      .join('');
  }
}

class FakeChannel {
  binaryType = 'blob';
  readonly sent: Uint8Array[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(
    readonly label: string,
    readonly init: RTCDataChannelInit | undefined,
  ) {}
  send(data: Uint8Array) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
  open() {
    this.onopen?.();
  }
  bytes(text: string) {
    this.onmessage?.({ data: new TextEncoder().encode(text).buffer });
  }
  typed(): string {
    return this.sent.map((b) => new TextDecoder().decode(b)).join('');
  }
}

class FakePeer {
  channel: FakeChannel | null = null;
  remote: RTCSessionDescriptionInit | null = null;
  localDescription: { sdp: string } | null = null;
  iceGatheringState = 'complete';
  connectionState = 'new';
  closed = false;
  onconnectionstatechange: (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  constructor(readonly config: RTCConfiguration) {}
  createDataChannel(label: string, init?: RTCDataChannelInit) {
    this.channel = new FakeChannel(label, init);
    return this.channel;
  }
  async createOffer() {
    return { type: 'offer', sdp: 'offer-sdp' };
  }
  async setLocalDescription(description: { sdp: string }) {
    this.localDescription = description;
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remote = description;
  }
  close() {
    this.closed = true;
  }
}

/** The channel the stream opened on its `index`th peer. */
function channelOf(peers: FakePeer[], index: number): FakeChannel {
  const channel = peers[index]?.channel;
  if (!channel) throw new Error(`peer ${index} opened no channel`);
  return channel;
}

function harness(direct = true) {
  const sockets: FakeSocket[] = [];
  const peers: FakePeer[] = [];
  const chunks: string[] = [];
  const paths: StreamPath[] = [];
  const stream = new AttachSessionStream({
    issueTicket: async () => ({ ticket: 't', url: '/api/v1/relay/attach' }),
    apiBaseUrl: 'https://api.example.com',
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    schedule: () => () => {},
    direct: () => direct,
    peerFactory: (config) => {
      const peer = new FakePeer(config);
      peers.push(peer);
      return peer as unknown as RTCPeerConnection;
    },
  });
  stream.onData((chunk, consumed) => {
    chunks.push(new TextDecoder().decode(chunk as Uint8Array));
    consumed();
  });
  stream.onPath?.((path) => paths.push(path));
  const settle = async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  };
  /** A socket attached with a direct path on offer. */
  const attach = async (offered = true) => {
    await settle();
    const socket = sockets.at(-1) as FakeSocket;
    socket.open();
    socket.text({
      type: 'attached',
      window: 0,
      ...(offered ? { direct: { iceServers: ['stun:stun.example.com:3478'] } } : {}),
    });
    await settle();
    return socket;
  };
  return { stream, sockets, peers, chunks, paths, settle, attach };
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket);
});

describe('the direct path', () => {
  it('offers one ordered channel when the relay invites it, with the ICE servers it named', async () => {
    const h = harness();
    const socket = await h.attach();
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0]?.config).toEqual({ iceServers: [{ urls: ['stun:stun.example.com:3478'] }] });
    expect(h.peers[0]?.channel?.label).toBe(DIRECT_CHANNEL_LABEL);
    expect(h.peers[0]?.channel?.init).toEqual({ ordered: true });
    expect(socket.controls()).toContainEqual({ type: 'direct.offer', sdp: 'offer-sdp' });

    socket.text({ type: 'direct.answer', sdp: 'answer-sdp' });
    await h.settle();
    expect(h.peers[0]?.remote).toEqual({ type: 'answer', sdp: 'answer-sdp' });
  });

  it('offers nothing when the relay did not invite it, or the caller does not want it', async () => {
    const uninvited = harness();
    await uninvited.attach(false);
    expect(uninvited.peers).toHaveLength(0);

    const unwanted = harness(false);
    await unwanted.attach();
    expect(unwanted.peers).toHaveLength(0);
  });

  it('moves keystrokes to the channel once it opens, after telling the host how many went on the relay', async () => {
    const h = harness();
    const socket = await h.attach();
    h.stream.send('ls');
    const channel = h.peers[0]?.channel as FakeChannel;
    channel.open();
    expect(socket.controls().at(-1)).toEqual({ type: 'direct.path', offset: 2 });
    h.stream.send(' -la\r');
    expect(socket.typed()).toBe('ls');
    expect(channel.typed()).toBe(' -la\r');
    expect(h.paths).toEqual(['relay', 'direct']);
  });

  it('holds channel output until the relay has delivered every byte before the offset', async () => {
    const h = harness();
    const socket = await h.attach();
    const channel = h.peers[0]?.channel as FakeChannel;
    channel.open();
    // The offset outran the relay's last bytes: they are still in flight.
    socket.text({ type: 'direct.path', offset: 5 });
    socket.bytes('abc');
    channel.bytes('XYZ');
    expect(h.chunks.join('')).toBe('abc');
    socket.bytes('de');
    channel.bytes('!');
    expect(h.chunks.join('')).toBe('abcdeXYZ!');
    // Channel output is credited on the socket like any other.
    expect(socket.controls().filter((m) => m.type === 'credit')).toContainEqual({
      type: 'credit',
      bytes: 3,
    });
  });

  it('goes back to the relay when output arrives there again (the host fell back)', async () => {
    const h = harness();
    const socket = await h.attach();
    const channel = h.peers[0]?.channel as FakeChannel;
    channel.open();
    socket.text({ type: 'direct.path', offset: 0 });
    channel.bytes('on the channel');
    // The host's channel closed on its side: its repaint comes on the relay.
    socket.bytes('repaint');
    expect(h.chunks.join('|')).toBe('on the channel|repaint');
    expect(h.peers[0]?.closed).toBe(true);
    expect(h.paths.at(-1)).toBe('relay');
    h.stream.send('x');
    expect(socket.typed()).toBe('x');
  });

  it('stops trying after the channel has failed twice, so a network that cannot hold one costs nothing more', async () => {
    const h = harness();
    let socket = await h.attach();
    channelOf(h.peers, 0).close();
    socket.drop(4504);
    socket = await h.attach();
    expect(h.peers).toHaveLength(2);
    channelOf(h.peers, 1).close();
    socket.drop(4504);
    await h.attach();
    expect(h.peers).toHaveLength(2);
  });

  it('a path the relay calls unavailable is dropped without counting against the stream', async () => {
    const h = harness();
    const socket = await h.attach();
    socket.text({ type: 'direct.unavailable', reason: 'too many direct peers on this host' });
    expect(h.peers[0]?.closed).toBe(true);
    h.stream.send('still typing');
    expect(socket.typed()).toBe('still typing');
  });

  it('closes the channel with its socket, and with the stream', async () => {
    const h = harness();
    const socket = await h.attach();
    socket.drop(4504);
    expect(h.peers[0]?.closed).toBe(true);
    await h.attach();
    h.stream.dispose();
    expect(h.peers[1]?.closed).toBe(true);
  });
});
