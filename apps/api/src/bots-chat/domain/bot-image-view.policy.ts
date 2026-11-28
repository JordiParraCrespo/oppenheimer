import { BOT_IMAGE_MAX_BYTES, BOT_IMAGE_MIME_TYPES } from '@oppenheimer/shared';

/**
 * Earlier images one turn may look at again (`view_image`), over all its
 * calls: each is sent to the model whole, so the cap bounds what a turn adds
 * to its context. A message carries up to four (`BOT_MESSAGE_IMAGES_MAX`).
 */
export const VIEWED_IMAGES_PER_TURN = 6;

/**
 * Whether a stored image may be shown to the model again: a type a bot's chat
 * takes, and within the upload limit. Both were checked on upload; a row that
 * no longer fits (a limit lowered since) is refused rather than sent.
 */
export function viewableImage(image: { mimeType: string; sizeBytes: number }): boolean {
  return (
    (BOT_IMAGE_MIME_TYPES as readonly string[]).includes(image.mimeType) &&
    image.sizeBytes > 0 &&
    image.sizeBytes <= BOT_IMAGE_MAX_BYTES
  );
}
