import { SESSION_IMAGE_MEDIA_TYPES } from '@oppenheimer/shared/protocol';

/**
 * The one rule for which files a session takes as images, on every gesture
 * and both panes: a drop, a paste or the paperclip, on New session or in a
 * running session's terminal.
 *
 * A file the browser labels as one of the types an agent reads, or a file
 * it does not label at all: a pasted screenshot often arrives with no type,
 * and the API judges the bytes either way. Anything else (a PDF, an SVG, a
 * folder) is not an image the agent can read, and the caller says so rather
 * than dropping it in silence.
 */
export function isSessionImage(file: File): boolean {
  return file.type === '' || (SESSION_IMAGE_MEDIA_TYPES as readonly string[]).includes(file.type);
}

/** The files a session takes as images, in the order they came. */
export function imagesIn(files: File[]): File[] {
  return files.filter(isSessionImage);
}

/**
 * Every file a paste or a drop carries. The clipboard lists a pasted
 * screenshot under `items`, sometimes with an empty `files`; a drop from the
 * file manager lists its files under `files`, sometimes with no items. Both
 * are read, the items first, without counting a file twice.
 */
export function filesIn(transfer: DataTransfer | null): File[] {
  if (!transfer) return [];
  const fromItems = Array.from(transfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  return fromItems.length > 0 ? fromItems : Array.from(transfer.files ?? []);
}
