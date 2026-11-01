import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proofTranscript, sdpFingerprints, toBase64Url } from '../direct-handshake';
import { DIRECT_CHANNEL_LABEL } from '../direct-path';
import { AttachSessionStream, type StreamPath } from '../session-stream';

/**
 * The direct path (`product/versions/mvp/22-direct-terminal-path.md`) against a
 * scripted socket and a scripted peer connection: what the stream promises the
 * terminal is the same bytes, in the same order, whichever path carried them,
 * and keystrokes reaching the host in the order they were typed; and that no
 * byte crosses a channel whose host has not proved itself (31).
 */

const OFFER_SDP = 'v=0\r\na=fingerprint:sha-256 0A:0B\r\n';
const ANSWER_SDP = 'v=0\r\na=fingerprint:sha-256 1A:1B\r\n';

/** A host key, and the proof it signs for a hello, as the runner does. */
async function hostKey() {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return {
    async prove(nonce: string, offer = OFFER_SDP, answer = ANSWER_SDP) {
      const transcript = proofTranscript(sdpFingerprints(offer), sdpFingerprints(answer), nonce);
      const sig = new Uint8Array(
        await crypto.subtle.sign(
          { name: 'Ed25519' },
          pair.privateKey,
          transcript as Uint8Array<ArrayBuffer>,
        ),
      );
      return { t: 'proof', v: 1, key: toBase64Url(raw), sig: toBase64Url(sig) };
    },
  };
}

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
  readonly sent: (string | Uint8Array)[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(
    readonly label: string,
    readonly init: RTCDataChannelInit | undefined,
  ) {}
  send(data: string | Uint8Array) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
  open() {
    this.onopen?.();
  }
  text(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  bytes(text: string) {
    this.onmessage?.({ data: new TextEncoder().encode(text).buffer });
  }
  /** The handshake messages the browser sent. */
  handshake(): { t: string; [key: string]: unknown }[] {
    return this.sent.filter((m): m is string => typeof m === 'string').map((m) => JSON.parse(m));
  }
  typed(): string {
    return this.sent
      .filter((b): b is Uint8Array => typeof b !== 'string')
      .map((b) => new TextDecoder().decode(b))
      .join('');
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
    return { type: 'offer', sdp: OFFER_SDP };
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

/** Pins outlive a stream on the page; every harness meets a host of its own. */
let hosts = 0;

function harness(direct = true) {
  hosts += 1;
  const hostId = `host-${hosts}`;
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
  // Macrotasks, not microtasks: the path is a dynamic import on the invitation.
  const settle = async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  };
  /** A socket attached with a direct path on offer. */
  const attach = async (offered = true) => {
    await settle();
    const socket = sockets.at(-1) as FakeSocket;
    socket.open();
    socket.text({
      type: 'attached',
      window: 0,
      ...(offered ? { direct: { iceServers: ['stun:stun.example.com:3478'], hostId } } : {}),
    });
    await settle();
    return socket;
  };
  let key: Awaited<ReturnType<typeof hostKey>> | null = null;
  /**
   * The host answers the `index`th offer, its channel opens, and the host
   * proves itself with `with` (this harness's own key by default).
   */
  const prove = async (index = 0, with_?: Awaited<ReturnType<typeof hostKey>>) => {
    key ??= await hostKey();
    const socket = sockets.at(-1) as FakeSocket;
    socket.text({ type: 'direct.answer', sdp: ANSWER_SDP });
    await settle();
    const channel = channelOf(peers, index);
    channel.open();
    const hello = channel.handshake().find((m) => m.t === 'hello');
    if (!hello) throw new Error('the browser said no hello');
    channel.text(await (with_ ?? key).prove(String(hello.nonce)));
    // The verdict is async (WebCrypto): let it land.
    for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    return channel;
  };
  return { stream, sockets, peers, chunks, paths, settle, attach, prove, hostId };
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeSocket);
  // Pins outlive a stream in this browser's storage; each test meets its
  // hosts afresh.
  localStorage.clear();
});

describe('the direct path', () => {
  it('offers one ordered channel when the relay invites it, with the ICE servers it named', async () => {
    const h = harness();
    const socket = await h.attach();
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0]?.config).toEqual({ iceServers: [{ urls: ['stun:stun.example.com:3478'] }] });
    expect(h.peers[0]?.channel?.label).toBe(DIRECT_CHANNEL_LABEL);
    expect(h.peers[0]?.channel?.init).toEqual({ ordered: true });
    expect(socket.controls()).toContainEqual({ type: 'direct.offer', sdp: OFFER_SDP });

    socket.text({ type: 'direct.answer', sdp: ANSWER_SDP });
    await h.settle();
    expect(h.peers[0]?.remote).toEqual({ type: 'answer', sdp: ANSWER_SDP });
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
    const channel = await h.prove();
    expect(channel.handshake().map((m) => m.t)).toEqual(['hello', 'ready']);
    expect(socket.controls().at(-1)).toEqual({ type: 'direct.path', offset: 2 });
    h.stream.send(' -la\r');
    expect(socket.typed()).toBe('ls');
    expect(channel.typed()).toBe(' -la\r');
    expect(h.paths).toEqual(['relay', 'direct']);
  });

  it('holds channel output until the relay has delivered every byte before the offset', async () => {
    const h = harness();
    const socket = await h.attach();
    const channel = await h.prove();
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
    const channel = await h.prove();
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

  it('carries nothing until the host has proved itself, and says hello first', async () => {
    const h = harness();
    const socket = await h.attach();
    socket.text({ type: 'direct.answer', sdp: ANSWER_SDP });
    await h.settle();
    const channel = channelOf(h.peers, 0);
    channel.open();
    expect(channel.handshake()).toEqual([
      { t: 'hello', v: 1, nonce: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) },
    ]);
    // Neither keystrokes nor the switch: the host has not proved itself.
    h.stream.send('secret');
    channel.bytes('not yet the host');
    expect(socket.typed()).toBe('secret');
    expect(channel.typed()).toBe('');
    expect(h.chunks).toEqual([]);
    expect(socket.controls().some((m) => m.type === 'direct.path')).toBe(false);
    expect(h.paths).toEqual(['relay']);
  });

  it('refuses a proof over fingerprints other than its own peer connection used: the man in the middle', async () => {
    const h = harness();
    const socket = await h.attach();
    socket.text({ type: 'direct.answer', sdp: ANSWER_SDP });
    await h.settle();
    const channel = channelOf(h.peers, 0);
    channel.open();
    const nonce = String(channel.handshake()[0]?.nonce);
    // The real host signed what it saw: an offer from the middle, not this browser's.
    const middle = 'v=0\r\na=fingerprint:sha-256 EE:EE\r\n';
    channel.text(await (await hostKey()).prove(nonce, middle));
    // The verdict is WebCrypto on Node's thread pool, so no count of ticks is
    // sure to outlast it on a loaded machine: wait for the close itself.
    await vi.waitFor(() => expect(h.peers[0]?.closed).toBe(true));
    expect(channel.handshake().map((m) => m.t)).toEqual(['hello']);
    h.stream.send('x');
    expect(socket.typed()).toBe('x');
  });

  it('pins the first key a host proves itself with, and refuses another for good', async () => {
    const h = harness();
    let socket = await h.attach();
    await h.prove(0);
    expect(h.paths.at(-1)).toBe('direct');
    socket.drop(4504);

    socket = await h.attach();
    const impostor = await hostKey();
    const channel = await h.prove(1, impostor);
    expect(channel.handshake().map((m) => m.t)).toEqual(['hello']);
    expect(h.peers[1]?.closed).toBe(true);
    expect(h.paths.at(-1)).toBe('relay');
    // What answered may not be the host: this stream does not ask again.
    socket.drop(4504);
    await h.attach();
    expect(h.peers).toHaveLength(2);
  });

  it('takes no direct path when the relay names no host to pin the key under', async () => {
    const h = harness();
    await h.settle();
    const socket = h.sockets.at(-1) as FakeSocket;
    socket.open();
    socket.text({ type: 'attached', window: 0, direct: { iceServers: [] } });
    await h.settle();
    expect(h.peers).toHaveLength(0);
  });

  it('counts relay output that arrives while the path is still loading toward the offset', async () => {
    const h = harness();
    await h.settle();
    const socket = h.sockets.at(-1) as FakeSocket;
    socket.open();
    socket.text({
      type: 'attached',
      window: 0,
      direct: { iceServers: [], hostId: h.hostId },
    });
    // Before the direct path's modules have loaded.
    socket.bytes('early');
    await h.settle();
    const channel = await h.prove();
    socket.text({ type: 'direct.path', offset: 5 });
    channel.bytes('!');
    expect(h.chunks.join('')).toBe('early!');
  });
});
