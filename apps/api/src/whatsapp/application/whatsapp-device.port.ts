/** Whether a host can be asked anything about its WhatsApp device now. */
export type WhatsappDeviceReach = 'online' | 'offline' | 'unsupported';

/** The message a send quotes. */
export interface WhatsappQuote {
  id: string;
  senderId: string;
}

/** What a send came to on the host. */
export type WhatsappSendOutcome =
  | { kind: 'sent'; id: string; sentAt: Date }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  /** The runner refused it: `code` is its `WHATSAPP_*` (002 not connected, 003 WhatsApp refused, 004 budget). */
  | { kind: 'failed'; code: string; detail?: string };

/** What asking the host for a voice note came to. */
export type WhatsappVoiceNoteOutcome =
  | { kind: 'fetched'; data: Buffer; mimetype: string }
  | { kind: 'host_offline' }
  /** The host's runner predates handing voice notes over (`whatsapp.voice`). */
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  /** The runner refused: `WA_002` not connected, `WA_005` unknown or too old, `WA_006` too large, `WA_007` WhatsApp refused. */
  | { kind: 'failed'; code: string; detail?: string };

/**
 * A host's WhatsApp linked device, over its runner link: the socket and the
 * keys are the runner's, so everything the control plane does to the device is
 * a frame to it. Pairing and unpairing are fire and forget, answered by the
 * `whatsapp.state` the host reports; a send waits for its answer.
 */
export interface WhatsappDevicePort {
  reach(hostId: string): WhatsappDeviceReach;
  /** Ask the host to pair a new device; false when the link would not take the frame. */
  link(hostId: string): boolean;
  /** Ask the host to log its device out and delete its keys; false when nothing reached it. */
  unlink(hostId: string): boolean;
  /**
   * Send a text; with `replyTo`, quoting that message (its WhatsApp id and
   * who wrote it). A runner from before quoting sends it unquoted.
   */
  send(
    hostId: string,
    chatId: string,
    text: string,
    replyTo?: WhatsappQuote,
  ): Promise<WhatsappSendOutcome>;
  /**
   * Send a voice note: Ogg/Opus audio running `seconds`, which the host
   * uploads and sends as push-to-talk. `not_supported` is a runner from
   * before it (`whatsapp.voice.send`).
   */
  sendVoice(
    hostId: string,
    chatId: string,
    audio: Buffer,
    seconds: number,
  ): Promise<WhatsappSendOutcome>;
  /** Fetch a voice note the number received, by its chat and WhatsApp id. */
  voiceNote(hostId: string, chatId: string, messageId: string): Promise<WhatsappVoiceNoteOutcome>;
}
