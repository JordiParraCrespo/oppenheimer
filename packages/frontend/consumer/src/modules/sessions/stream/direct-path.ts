/**
 * The browser's half of the direct terminal path
 * (`product/versions/mvp/22-direct-terminal-path.md`): one WebRTC data channel
 * to the session's host, beside the attach socket, for one attachment.
 *
 * The attach socket stays the source of truth for everything but bytes: the
 * offer and answer travel on it, so does the credit, so does the resize. The
 * channel carries PTY output one way and keystrokes the other, binary only.
 *
 * Each direction switches at a byte offset. Output: the host says after how
 * many relay bytes its output moved (`direct.path`), and channel bytes are
 * held until the relay has delivered that many, then flow in order. Input:
 * once the channel opens, the stream tells the host how many keystroke bytes
 * it sent on the relay, and types on the channel from then on.
 */

/** The data channel's name; the host answers no other. */
export const DIRECT_CHANNEL_LABEL = 'pty';

/**
 * How long the offer waits for ICE candidates. The offer carries every
 * candidate (no trickle), and host candidates, the ones a reader beside the
 * host needs, come first.
 */
const GATHER_TIMEOUT_MS = 2_000;

/** How long an offer may go unanswered before the attempt is given up. */
const ANSWER_TIMEOUT_MS = 15_000;

export interface DirectPathHooks {
  /** Send the offer on the attach socket. */
  offer(sdp: string): void;
  /** The channel can carry bytes: move the input to it. */
  opened(): void;
  /** Output from the channel, in order, once it has taken over from the relay. */
  deliver(bytes: Uint8Array): void;
  /** The channel is gone, or never came: the attachment stays on (or goes back to) the relay. */
  ended(): void;
}

export type PeerFactory = (config: RTCConfiguration) => RTCPeerConnection;

export interface DirectPathOptions {
  iceServers: readonly string[];
  hooks: DirectPathHooks;
  /** Injected in tests; `RTCPeerConnection` otherwise. */
  peerFactory?: PeerFactory;
  /** Injected in tests; `setTimeout` otherwise. */
  schedule?: (fn: () => void, ms: number) => () => void;
}

const defaultSchedule = (fn: () => void, ms: number) => {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
};

/** Whether this browser can open a direct path at all. */
export function directPathSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}

export class DirectPath {
  private readonly pc: RTCPeerConnection;
  private readonly channel: RTCDataChannel;
  private readonly schedule: (fn: () => void, ms: number) => () => void;
  private cancelAnswerTimeout: (() => void) | null = null;
  private ended = false;
  private open = false;
  /** The relay byte the host's output moved after; `null` until it says. */
  private outputOffset: number | null = null;
  private relayReceived = 0;
  /** Output owns the terminal: the relay has delivered everything before the offset. */
  private outputLive = false;
  /** Channel output that arrived before the relay caught up to the offset. */
  private held: Uint8Array[] = [];

  constructor(private readonly options: DirectPathOptions) {
    this.schedule = options.schedule ?? defaultSchedule;
    const factory: PeerFactory = options.peerFactory ?? ((config) => new RTCPeerConnection(config));
    this.pc = factory(
      options.iceServers.length > 0 ? { iceServers: [{ urls: [...options.iceServers] }] } : {},
    );
    this.channel = this.pc.createDataChannel(DIRECT_CHANNEL_LABEL, { ordered: true });
    this.channel.binaryType = 'arraybuffer';
    this.channel.onopen = () => {
      if (this.ended) return;
      this.open = true;
      this.options.hooks.opened();
    };
    this.channel.onmessage = (event: MessageEvent) => {
      if (this.ended || typeof event.data === 'string') return;
      const bytes = new Uint8Array(event.data as ArrayBuffer);
      if (bytes.byteLength === 0) return;
      if (this.outputLive) this.options.hooks.deliver(bytes);
      else this.held.push(bytes);
    };
    this.channel.onclose = () => this.end();
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === 'failed' || state === 'closed') this.end();
    };
  }

  /** Gather candidates and send the offer. */
  async start(): Promise<void> {
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await this.gathered();
      const sdp = this.pc.localDescription?.sdp;
      if (this.ended || !sdp) return;
      this.cancelAnswerTimeout = this.schedule(() => {
        if (!this.open) this.end();
      }, ANSWER_TIMEOUT_MS);
      this.options.hooks.offer(sdp);
    } catch {
      this.end();
    }
  }

  /** The host's answer. */
  async answer(sdp: string): Promise<void> {
    if (this.ended) return;
    try {
      await this.pc.setRemoteDescription({ type: 'answer', sdp });
    } catch {
      this.end();
    }
  }

  /** The host's output moved to the channel after `offset` relay bytes. */
  outputMoved(offset: number): void {
    if (this.ended) return;
    this.outputOffset = offset;
    this.catchUp();
  }

  /**
   * `bytes` more arrived on the relay. Before the switch that is the relay
   * catching up to the offset. After it, the host has gone back to the link —
   * its channel closed on its side — and this path is over.
   */
  relayDelivered(bytes: number): void {
    if (this.ended) return;
    if (this.outputLive) {
      this.end();
      return;
    }
    this.relayReceived += bytes;
    this.catchUp();
  }

  /** Whether keystrokes go on the channel. */
  get carriesInput(): boolean {
    return this.open && !this.ended;
  }

  sendInput(bytes: Uint8Array): void {
    if (!this.carriesInput) return;
    this.channel.send(bytes as Uint8Array<ArrayBuffer>);
  }

  /** Ends the path. `ended` is called once, whoever ends it. */
  close(): void {
    this.end();
  }

  private catchUp(): void {
    if (this.outputLive || this.outputOffset === null) return;
    if (this.relayReceived < this.outputOffset) return;
    this.outputLive = true;
    const held = this.held;
    this.held = [];
    for (const bytes of held) this.options.hooks.deliver(bytes);
  }

  private gathered(): Promise<void> {
    if (this.pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const cancel = this.schedule(resolve, GATHER_TIMEOUT_MS);
      this.pc.onicegatheringstatechange = () => {
        if (this.pc.iceGatheringState !== 'complete') return;
        cancel();
        resolve();
      };
    });
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    this.open = false;
    this.held = [];
    this.cancelAnswerTimeout?.();
    try {
      this.channel.close();
      this.pc.close();
    } catch {
      // Already closed; nothing else to release.
    }
    this.options.hooks.ended();
  }
}
