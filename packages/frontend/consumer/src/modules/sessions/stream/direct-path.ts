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
 *
 * "Opens" means the host has proved itself (`direct-handshake.ts`, 31): the
 * data channel's own open only starts the handshake, and nothing but the
 * handshake crosses the channel until the proof is accepted.
 */
import {
  type HostKeyPins,
  judgeHostProof,
  newNonce,
  PROOF_VERSION,
  type ProofVerdict,
} from './direct-handshake';

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
  /**
   * The channel is gone, or never came: the attachment stays on (or goes back
   * to) the relay. `distrusted` is a host whose proof was refused: its key
   * changed since this browser pinned it, or the proof did not verify.
   */
  ended(distrusted?: Exclude<ProofVerdict, 'trusted'>): void;
}

export type PeerFactory = (config: RTCConfiguration) => RTCPeerConnection;

export interface DirectPathOptions {
  iceServers: readonly string[];
  /** The host the channel reaches, which its key is pinned under. */
  hostId: string;
  pins: HostKeyPins;
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
  /** The SDP this browser offered, and the host's answer as applied. */
  private offerSdp: string | null = null;
  private answerSdp: string | null = null;
  /** This handshake's nonce, once hello is sent. */
  private nonce: string | null = null;
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
      this.nonce = newNonce();
      this.channel.send(JSON.stringify({ t: 'hello', v: PROOF_VERSION, nonce: this.nonce }));
    };
    this.channel.onmessage = (event: MessageEvent) => {
      if (this.ended) return;
      if (typeof event.data === 'string') {
        void this.proof(event.data);
        return;
      }
      // Bytes before the proof are no host's output.
      if (!this.open) return;
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
      this.offerSdp = sdp;
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
      this.answerSdp = sdp;
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

  /**
   * The host's proof, the one text message it sends. Accepted, the browser
   * says ready and the channel carries the terminal; refused, the channel
   * closes and the pane stays on the relay.
   */
  private async proof(text: string): Promise<void> {
    if (this.open || !this.nonce || !this.offerSdp || !this.answerSdp) {
      this.end('invalid');
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      this.end('invalid');
      return;
    }
    const verdict = await judgeHostProof({
      message,
      hostId: this.options.hostId,
      offerSdp: this.offerSdp,
      answerSdp: this.answerSdp,
      nonce: this.nonce,
      pins: this.options.pins,
    });
    if (this.ended) return;
    if (verdict !== 'trusted') {
      this.end(verdict);
      return;
    }
    this.channel.send(JSON.stringify({ t: 'ready', v: PROOF_VERSION }));
    this.open = true;
    this.options.hooks.opened();
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

  private end(distrusted?: Exclude<ProofVerdict, 'trusted'>): void {
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
    this.options.hooks.ended(distrusted);
  }
}
