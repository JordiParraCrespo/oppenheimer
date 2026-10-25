import {
  BOT_IMAGE_MAX_BYTES,
  BOT_IMAGE_MIME_TYPES,
  BOT_MESSAGE_IMAGES_MAX,
} from '@oppenheimer/shared/schemas/bot';

/** What the image picker offers: the four types a bot reads. */
export const BOT_IMAGE_ACCEPT = BOT_IMAGE_MIME_TYPES.join(',');

/** One image the composer holds for the next message (`25-bots.md` §3.1). */
export interface HeldImage {
  /** Its key in the composer, so two files with one name stay two tiles. */
  key: string;
  file: File;
  /** Uploading until the API stored it; failed when it refused it. */
  status: 'uploading' | 'ready' | 'failed';
  /** The upload's id, once stored: what the message names. */
  attachmentId: string | null;
  /** Why the upload failed, for the line under the composer. */
  error: unknown;
}

/** Why a picked file is not held, as the key of its sentence under `bots.chat.images`. */
export type ImageRefusal = 'noVision' | 'notSupported' | 'tooLarge' | 'tooMany';

/**
 * Whether the composer holds `file`, beside `held` images already: only for
 * a model that reads images, only the four types (a file with no type, as a
 * pasted screenshot can be, is left to the API, which judges the bytes), up
 * to 5 MB, and four to a message. The API holds every one of these again.
 */
export function imageRefusal(
  file: Pick<File, 'type' | 'size'>,
  held: number,
  takesImages: boolean,
): ImageRefusal | null {
  if (!takesImages) return 'noVision';
  if (file.type && !(BOT_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'notSupported';
  }
  if (file.size > BOT_IMAGE_MAX_BYTES) return 'tooLarge';
  if (held >= BOT_MESSAGE_IMAGES_MAX) return 'tooMany';
  return null;
}

/**
 * Why the message cannot go yet though it can be written, as the key of its
 * sentence; null when it can. Images held for a model that reads none (the
 * model changed after they were picked), one still uploading, or one the
 * API refused: the person removes it, waits, or switches the model, and the
 * words stay where they are.
 */
export function heldImagesBlock(
  images: readonly HeldImage[],
  takesImages: boolean,
): 'noVisionHeld' | 'uploading' | 'failedHeld' | null {
  if (images.length === 0) return null;
  if (!takesImages) return 'noVisionHeld';
  if (images.some((image) => image.status === 'uploading')) return 'uploading';
  if (images.some((image) => image.status === 'failed')) return 'failedHeld';
  return null;
}
