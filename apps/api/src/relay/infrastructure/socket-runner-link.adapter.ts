import type { ProtocolMessage, RunnerCapability } from '@oppenheimer/shared/protocol';
import type { WebSocket } from 'ws';
import type {
  AttachmentSink,
  RunnerLink,
  SentSessionCommand,
} from '../../links/application/link-registry.port';
import { encodeFrame } from './frame.util';
import { LinkAttachments } from './link-attachments.util';

/**
 * The bytes a runner may have queued for it before it is dropped as a slow
 * consumer. Bounded queues everywhere (`02-runner.md` §7): a link that cannot
 * keep up is closed, never allowed to hold the process's memory.
 */
export const LINK_MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

/**
 * The session commands whose refusal belongs in the session's log. An attach
 * is not one of them: its refusal belongs to the browser that asked, and the
 * attachment table already routes it there.
 */
const SESSION_COMMANDS = new Set([
  'session.create',
  'session.stop',
  'session.restart',
  'session.close',
  'session.window.open',
  'session.window.close',
  // A pasted image's refusal (the pull, the bytes, the window, a stopped
  // pane) is the only word that the path never reached the prompt. The
  // command is small: its image is pulled over HTTPS, never sent here.
  'session.image',
]);

/**
 * How many sent commands a link remembers. A runner answers a command it can
 * do by doing it, so a success never clears an entry; the oldest go first, and
 * a refusal arrives within a heartbeat of the command, never hundreds later.
 */
const MAX_REMEMBERED_COMMANDS = 256;

/**
 * A `RunnerLink` over one accepted `ws` socket. Everything the rest of the
 * control plane may do to a link goes through here, so the socket and the
 * frame layout never leave the relay module.
 */
export class SocketRunnerLink implements RunnerLink {
  private readonly attachments = new LinkAttachments();
  private readonly commands = new Map<string, SentSessionCommand>();
  /** Set by the gateway on every pong; see `RunnerLink.roundTripMillis`. */
  roundTripMillis: number | null = null;
  /** When the link opened, for `host_presence.connectedAt`. */
  readonly connectedAt = new Date();

  constructor(
    readonly hostId: string,
    readonly runId: string,
    readonly epoch: number,
    private readonly socket: WebSocket,
    readonly capabilities: readonly RunnerCapability[] = [],
  ) {}

  send(message: ProtocolMessage): boolean {
    if (!this.writable) return false;
    this.socket.send(JSON.stringify(message));
    this.remember(message);
    return true;
  }

  takeSessionCommand(commandId: string): SentSessionCommand | undefined {
    const command = this.commands.get(commandId);
    this.commands.delete(commandId);
    return command;
  }

  private remember(message: ProtocolMessage): void {
    if (!SESSION_COMMANDS.has(message.type)) return;
    if (!('commandId' in message) || !('sessionId' in message)) return;
    this.commands.set(message.commandId, { type: message.type, sessionId: message.sessionId });
    if (this.commands.size > MAX_REMEMBERED_COMMANDS) {
      const oldest = this.commands.keys().next().value;
      if (oldest !== undefined) this.commands.delete(oldest);
    }
  }

  sendBinary(attachmentId: number, bytes: Uint8Array): boolean {
    if (!this.writable) return false;
    this.socket.send(encodeFrame(attachmentId, bytes), { binary: true });
    return true;
  }

  openAttachment(sink: AttachmentSink, commandId: string): number {
    return this.attachments.open(sink, commandId);
  }

  closeAttachment(attachmentId: number): void {
    this.attachments.close(attachmentId);
  }

  attachment(attachmentId: number): AttachmentSink | undefined {
    return this.attachments.get(attachmentId);
  }

  attachmentByCommand(commandId: string): AttachmentSink | undefined {
    return this.attachments.byCommandId(commandId);
  }

  get attachmentCount(): number {
    return this.attachments.size;
  }

  /** Every attachment, forgotten: what the link's close hands to the browsers. */
  drainAttachments(): AttachmentSink[] {
    return this.attachments.drain();
  }

  close(code: number, reason: string): void {
    if (
      this.socket.readyState === this.socket.OPEN ||
      this.socket.readyState === this.socket.CONNECTING
    ) {
      this.socket.close(code, reason);
    }
  }

  /**
   * Whether a frame may be written. A runner past the buffer bound is closed
   * rather than skipped: dropping one frame silently would lose a keystroke or
   * a credit — and a lost credit stalls its pane for good — while a close sends
   * every browser through the reconnect ladder onto a fresh link.
   */
  private get writable(): boolean {
    if (this.socket.readyState !== this.socket.OPEN) return false;
    if (this.socket.bufferedAmount >= LINK_MAX_BUFFERED_BYTES) {
      this.close(1013, 'slow consumer');
      return false;
    }
    return true;
  }
}
