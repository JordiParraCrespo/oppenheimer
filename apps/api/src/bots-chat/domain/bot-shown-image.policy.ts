/**
 * Images a bot shows the person (`25-bots.md` §4.7, `show_image`): fetched
 * from the web by their address, stored as the chat's own images, and drawn
 * under the bot's reply the way the person's sit over theirs.
 */

/** Images one turn may show, over all its `show_image` calls. */
export const SHOWN_IMAGES_PER_TURN = 8;

/** The key a `show_image` call's data carries the images it stored under, as JSON. */
export const SHOWN_IMAGES_DATA_KEY = 'shownImages';

/**
 * The name an image is kept under, for the chat's alt text and the viewer's
 * title: the caption the bot gave it, or the last segment of its address,
 * or `image` when the address ends in none.
 */
export function shownImageName(url: string, caption: string | undefined): string {
  if (caption?.trim()) return caption.trim();
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : 'image';
  } catch {
    return 'image';
  }
}
