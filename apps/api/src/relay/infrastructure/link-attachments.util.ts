import type { AttachmentSink } from '../../links/application/link-registry.port';
import { MAX_ATTACHMENT_ID } from './frame.util';

/**
 * The attachments open on one link: the id table the control plane owns
 * (01: "the control plane allocates attachment ids per link and frees them on
 * detach"), plus the command that opened each, so a `command.failed` can be
 * routed to the browser that is waiting on it.
 *
 * Ids are never reused while open and count upward from 1; 0 is left unused so
 * a zeroed header is never a valid frame.
 */
export class LinkAttachments {
  private readonly sinks = new Map<number, AttachmentSink>();
  private readonly byCommand = new Map<string, number>();
  private next = 1;

  open(sink: AttachmentSink, commandId: string): number {
    const id = this.allocate();
    this.sinks.set(id, sink);
    this.byCommand.set(commandId, id);
    return id;
  }

  close(id: number): AttachmentSink | undefined {
    const sink = this.sinks.get(id);
    this.sinks.delete(id);
    for (const [commandId, attachmentId] of this.byCommand) {
      if (attachmentId === id) this.byCommand.delete(commandId);
    }
    return sink;
  }

  get(id: number): AttachmentSink | undefined {
    return this.sinks.get(id);
  }

  byCommandId(commandId: string): AttachmentSink | undefined {
    const id = this.byCommand.get(commandId);
    return id === undefined ? undefined : this.sinks.get(id);
  }

  get size(): number {
    return this.sinks.size;
  }

  /** Every open attachment, for closing them all when the link goes. */
  drain(): AttachmentSink[] {
    const all = [...this.sinks.values()];
    this.sinks.clear();
    this.byCommand.clear();
    return all;
  }

  private allocate(): number {
    // Wrap past the 32-bit ceiling rather than fail: a link that opened four
    // billion attachments has long since freed the low ones.
    for (let attempts = 0; attempts <= MAX_ATTACHMENT_ID; attempts += 1) {
      const candidate = this.next;
      this.next = this.next >= MAX_ATTACHMENT_ID ? 1 : this.next + 1;
      if (!this.sinks.has(candidate)) return candidate;
    }
    throw new RangeError('no free attachment id on this link');
  }
}
