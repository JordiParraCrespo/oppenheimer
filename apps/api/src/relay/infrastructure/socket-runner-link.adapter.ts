import type { WebSocket } from 'ws';
import type { AttachmentSink, RunnerLink } from '../../links/application/link-registry.port';
import { encodeFrame } from './frame.util';
import { LinkAttachments } from './link-attachments.util';

/**
 * The bytes a runner may have queued for it before it is dropped as a slow
 * consumer. Bounded queues everywhere (`02-runner.md` §7): a link that cannot
 * keep up is closed, never allowed to hold the process's memory.
 */
export const LINK_MAX_BUFFERED_BYTES = 8 * 1024 * 1024;

/**
 * A `RunnerLink` over one accepted `ws` socket. Everything the rest of the
 * control plane may do to a link goes through here, so the socket and the
 * frame layout never leave the relay module.
 */
export class SocketRunnerLink implements RunnerLink {
  private readonly attachments = new LinkAttachments();

  constructor(
    readonly hostId: string,
    readonly runId: string,
    readonly epoch: number,
    private readonly socket: WebSocket,
  ) {}

  send(message: Record<string, unknown>): boolean {
    if (!this.writable) return false;
    this.socket.send(JSON.stringify(message));
    return true;
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

  private get writable(): boolean {
    return (
      this.socket.readyState === this.socket.OPEN &&
      this.socket.bufferedAmount < LINK_MAX_BUFFERED_BYTES
    );
  }
}
