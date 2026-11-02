import type { AttachClientMessage, AttachServerMessage } from '@oppenheimer/shared/protocol';
import type { HostKeyPins } from './direct-handshake';
import type { DirectPath, PeerFactory } from './direct-path';

/**
 * Which way the terminal's bytes travel: through the relay, or on a direct
 * channel to the host (`product/versions/mvp/22-direct-terminal-path.md`).
 */
export type RelayPath = 'relay' | 'direct';

type DirectServerMessage = Extract<
  AttachServerMessage,
  { type: 'direct.answer' | 'direct.path' | 'direct.unavailable' }
>;

/**
 * Direct paths a stream gives up on before it stops trying for the rest of its
 * life: a network that cannot hold one should not cost a renegotiation on
 * every reconnect.
 */
const MAX_DIRECT_FAILURES = 2;

export interface PathSwitchOptions {
  /** Whether to take a direct path when one is offered; asked at each offer. */
  want?: () => boolean;
  peerFactory?: PeerFactory;
  /** The host keys this browser has pinned; its own storage when absent. */
  pins?: HostKeyPins;
  schedule: (fn: () => void, ms: number) => () => void;
  /** A control message on the attach socket. */
  tell: (message: AttachClientMessage) => void;
  /** Output that came on the channel, for the terminal. */
  deliver: (bytes: Uint8Array) => void;
}

/**
 * The stream's byte path: which way keystrokes go, how many went on the
 * relay (the input offset a direct path moves at), whether a direct path is
 * worth trying again, and who is told when the path changes. `DirectPath` is
 * the peer; this decides when to have one and what the stream sees of it.
 *
 * One per stream. `reset` is a new socket: the path goes back to the relay and
 * the counts start again, but the failure count is the stream's.
 */
export class PathSwitch {
  private readonly listeners = new Set<(path: RelayPath) => void>();
  private direct: DirectPath | null = null;
  /** Keystroke bytes sent on this socket. */
  private relaySent = 0;
  /**
   * Output bytes the relay delivered on this socket. The host's output offset
   * counts from the attachment's start, so a path that loads after some of
   * them arrived starts from this count, not from zero.
   */
  private relayReceived = 0;
  private path: RelayPath = 'relay';
  private failures = 0;
  /** The host keys pinned so far; this browser's storage, once the path loads. */
  private pins: HostKeyPins | null;
  /** Moves on every drop, so a path still loading for an older socket is not started. */
  private generation = 0;

  constructor(private readonly options: PathSwitchOptions) {
    this.pins = options.pins ?? null;
  }

  onPath(listener: (path: RelayPath) => void): () => void {
    listener(this.path);
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * The relay invited a direct path for this attachment, to `hostId`. With no
   * host named there is nothing to pin the key under, so no direct path.
   */
  invited(iceServers: readonly string[], hostId: string | undefined): void {
    if (!hostId) return;
    if (!this.options.want?.() || this.failures >= MAX_DIRECT_FAILURES) return;
    if (!this.options.peerFactory && typeof RTCPeerConnection === 'undefined') return;
    // Loaded on the invitation: a pane on the relay, which is every pane
    // before its first offer, never downloads the peer or the proof.
    const generation = this.generation;
    void Promise.all([import('./direct-path'), import('./direct-handshake')]).then(
      ([{ DirectPath }, { browserHostKeyPins }]) => {
        if (generation !== this.generation || this.direct) return;
        this.pins ??= browserHostKeyPins();
        const direct: DirectPath = new DirectPath({
          iceServers,
          hostId,
          pins: this.pins,
          peerFactory: this.options.peerFactory,
          schedule: this.options.schedule,
          hooks: {
            offer: (sdp) => this.options.tell({ type: 'direct.offer', sdp }),
            opened: () => {
              if (this.direct !== direct) return;
              // Everything typed so far went on the relay; the host types what
              // the channel carries only after that many bytes.
              this.options.tell({ type: 'direct.path', offset: this.relaySent });
              this.setPath('direct');
            },
            deliver: (bytes) => {
              if (this.direct === direct) this.options.deliver(bytes);
            },
            ended: (distrusted) => {
              if (this.direct !== direct) return;
              // A path that never opened, or one that closed under the
              // terminal: either way the relay carries on, and the host
              // repaints whatever the channel lost. A host whose proof was
              // refused is not asked again by this stream: what answered may
              // not be the host.
              this.direct = null;
              this.failures = distrusted ? MAX_DIRECT_FAILURES : this.failures + 1;
              this.setPath('relay');
            },
          },
        });
        this.direct = direct;
        direct.relayDelivered(this.relayReceived);
        void direct.start();
      },
    );
  }

  /** The relay's `direct.*` messages for this attachment. */
  control(message: DirectServerMessage): void {
    switch (message.type) {
      case 'direct.answer':
        void this.direct?.answer(message.sdp);
        return;
      case 'direct.path':
        this.direct?.outputMoved(message.offset);
        return;
      case 'direct.unavailable':
        // Not a failure: the host or the relay said no, which a retry would
        // only hear again on this attachment.
        this.drop();
        return;
    }
  }

  /** Keystrokes: on the channel once it carries them, on the relay otherwise. */
  send(bytes: Uint8Array<ArrayBuffer>, onRelay: (bytes: Uint8Array<ArrayBuffer>) => void): void {
    if (this.direct?.carriesInput) {
      this.direct.sendInput(bytes);
      return;
    }
    onRelay(bytes);
    this.relaySent += bytes.byteLength;
  }

  /** `bytes` arrived on the relay, after the terminal was handed them. */
  relayDelivered(bytes: number): void {
    this.relayReceived += bytes;
    this.direct?.relayDelivered(bytes);
  }

  /** A new socket, or none: back to the relay, counts from zero. */
  reset(): void {
    this.drop();
    this.relaySent = 0;
    this.relayReceived = 0;
  }

  dispose(): void {
    this.drop();
    this.listeners.clear();
  }

  /** Ends the direct path without counting it against the stream. */
  private drop(): void {
    this.generation += 1;
    const direct = this.direct;
    this.direct = null;
    direct?.close();
    this.setPath('relay');
  }

  private setPath(next: RelayPath): void {
    if (this.path === next) return;
    this.path = next;
    for (const listener of this.listeners) listener(next);
  }
}
