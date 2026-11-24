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
    // Never the type itself: the sender writes it, and the reason is read
    // outside the fence a contact's words sit in.
    return { seen: false, reason: 'it is not a kind of image a bot can see' };
  }
  if (data.length === 0 || data.length > BOT_IMAGE_MAX_BYTES) {
    return { seen: false, reason: `it is ${data.length} bytes, which a bot cannot be sent` };
  }
  return { seen: true, data, mimeType: mimeType as BotImageMimeType };
}

/**
 * Why an image went unseen on a bot whose model reads no images: it is not
 * fetched at all, since the model could not be sent it.
 */
export const WHATSAPP_IMAGE_BLIND_MODEL_REASON = "this bot's model reads no images";

/** An image as a bot reads it when it could not see it: `[image, could not be seen: …]`. */
export function whatsappUnseenImageText(reason: string): string {
  return `[image, could not be seen: ${reason}]`;
}
