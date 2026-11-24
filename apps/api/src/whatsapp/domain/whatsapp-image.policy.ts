import {
  BOT_IMAGE_MAX_BYTES,
  BOT_IMAGE_MIME_TYPES,
  type BotImageMimeType,
} from '@oppenheimer/shared';

/**
 * Whether a bot could see an image a linked number received: its bytes, as
 * the host handed them over, in a type a bot's chat takes, or why not, in
 * words the bot can pass on ("I could not see your image: …").
 */
export type WhatsappImageSight =
  | { seen: true; data: Buffer; mimeType: BotImageMimeType }
  | { seen: false; reason: string };

/**
 * What the host handed over comes to: an image a bot's chat takes (one of
 * `BOT_IMAGE_MIME_TYPES`, its parameters dropped, within
 * `BOT_IMAGE_MAX_BYTES`), or why it is not one.
 */
export function whatsappImageSightOf(data: Buffer, mimetype: string): WhatsappImageSight {
  const mimeType = mimetype.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!(BOT_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { seen: false, reason: `it is not an image a bot can see (${mimetype})` };
  }
  if (data.length === 0 || data.length > BOT_IMAGE_MAX_BYTES) {
    return { seen: false, reason: `it is ${data.length} bytes, which a bot cannot be sent` };
  }
  return { seen: true, data, mimeType: mimeType as BotImageMimeType };
}

/** How asking the host for an image ended, when it did not hand it over. */
export type WhatsappImageMiss =
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string };

/** Why an image the host did not hand over went unseen. */
export function whatsappImageMissReason(miss: WhatsappImageMiss): string {
  switch (miss.kind) {
    case 'host_offline':
      return 'the host that holds the WhatsApp number is offline';
    case 'not_supported':
      return "the host's runner is too old to hand images over; updating it fixes this";
    case 'timed_out':
      return 'the host did not hand the image over in time';
    case 'failed':
      return FAILED[miss.code] ?? `the host refused (${miss.code})`;
  }
}

const FAILED: Readonly<Record<string, string>> = {
  WA_002: 'the WhatsApp number is not connected on its host',
  WA_005: 'the host no longer has it (images can be fetched for 48 hours)',
  WA_006: 'it is too large to hand over',
  WA_007: "WhatsApp's media server would not hand it over",
};

/** An image as a bot reads it when it could not see it: `[image, could not be seen: …]`. */
export function whatsappUnseenImageText(reason: string): string {
  return `[image, could not be seen: ${reason}]`;
}
