/** Whether a host can be asked anything about its WhatsApp device now. */
export type WhatsappDeviceReach = 'online' | 'offline' | 'unsupported';

/** What a send came to on the host. */
export type WhatsappSendOutcome =
  | { kind: 'sent'; id: string; sentAt: Date }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  /** The runner refused it: `code` is its `WHATSAPP_*` (002 not connected, 003 WhatsApp refused, 004 budget). */
  | { kind: 'failed'; code: string; detail?: string };

/**
 * A host's WhatsApp linked device, over its runner link
 * (`product/next-steps/whatsapp.md` §2): the socket and the keys are the
 * runner's, so everything the control plane does to the device is a frame to
 * it. Pairing and unpairing are fire and forget, answered by the
 * `whatsapp.state` the host reports; a send waits for its answer.
 */
export interface WhatsappDevicePort {
  reach(hostId: string): WhatsappDeviceReach;
  /** Ask the host to pair a new device; false when the link would not take the frame. */
  link(hostId: string): boolean;
  /** Ask the host to log its device out and delete its keys; false when nothing reached it. */
  unlink(hostId: string): boolean;
  send(hostId: string, chatId: string, text: string): Promise<WhatsappSendOutcome>;
}
