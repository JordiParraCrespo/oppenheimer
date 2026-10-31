import type { AttachClientMessage, AttachServerMessage } from '@oppenheimer/shared/protocol';
import type { AttachmentSignal, RunnerLink } from '../../links/application/link-registry.port';

/** What an attachment may offer its browser for a direct path (`directPathFor`). */
export interface DirectPathOffer {
  iceServers: string[];
  /** The host the channel reaches: the browser pins its key under this (31). */
  hostId: string;
}

type BrowserSignal = Extract<AttachClientMessage, { type: 'direct.offer' | 'direct.path' }>;

/**
 * One attachment's direct-path signalling
 * (`product/versions/mvp/22-direct-terminal-path.md`): the translation between
 * the attach socket's `direct.*` vocabulary and the link's
 * `attachment.direct.*` / `attachment.path`, and the rule that a browser gets
 * one offer, and only when it was invited. Whether it is invited at all is the
 * gateway's (`directPathFor`); the attachment owns one of these and hands it
 * the messages, and knows nothing else about the direct path.
 */
export class DirectPathSignalling {
  private offered = false;

  constructor(
    /** `null`: no direct path for this attachment; every offer is refused. */
    private readonly offer: DirectPathOffer | null,
    private readonly link: RunnerLink,
    private readonly tell: (message: AttachServerMessage) => void,
  ) {}

  /** What `attached` carries: the invitation, when there is one. */
  invitation(): { direct?: DirectPathOffer } {
    return this.offer
      ? { direct: { iceServers: this.offer.iceServers, hostId: this.offer.hostId } }
      : {};
  }

  /** A `direct.*` message from the browser, for the attachment `attachmentId` (null before one exists). */
  fromBrowser(message: BrowserSignal, attachmentId: number | null, attached: boolean): void {
    if (message.type === 'direct.offer') {
      this.forwardOffer(message.sdp, attachmentId, attached);
      return;
    }
    // Where the browser's keystrokes moved to the channel. Only for an offer
    // this relay forwarded: anything else is a browser speaking out of turn,
    // and the runner has no channel to wait on.
    if (this.offered && attachmentId !== null) {
      this.link.send({ type: 'attachment.path', attachmentId, offset: message.offset });
    }
  }

  /** The runner's side, forwarded to the browser in its own words. */
  fromRunner(message: AttachmentSignal): void {
    switch (message.type) {
      case 'attachment.direct.answer':
        this.tell({ type: 'direct.answer', sdp: message.sdp });
        return;
      case 'attachment.direct.refused':
        this.tell({ type: 'direct.unavailable', reason: message.reason });
        return;
      case 'attachment.path':
        this.tell({ type: 'direct.path', offset: message.offset });
        return;
    }
  }

  /**
   * Forwards the offer to the runner, once, and only when this attachment was
   * invited to make one. Any other offer is answered `direct.unavailable` and
   * the attachment stays on the relay.
   */
  private forwardOffer(sdp: string, attachmentId: number | null, attached: boolean): void {
    if (!this.offer || !attached || attachmentId === null || this.offered) {
      this.tell({ type: 'direct.unavailable', reason: 'no direct path for this terminal' });
      return;
    }
    this.offered = true;
    const sent = this.link.send({
      type: 'attachment.direct.offer',
      attachmentId,
      sdp,
      iceServers: this.offer.iceServers,
    });
    if (!sent) this.tell({ type: 'direct.unavailable', reason: 'the host is not reachable' });
  }
}
