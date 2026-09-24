import { SESSION_IMAGE_MEDIA_TYPES } from '@oppenheimer/shared/schemas/session';

/**
 * The image in a paste or a drop, if there is one.
 *
 * An agent reads its host's clipboard, never the browser's, so a screenshot
 * pasted into the terminal would reach it as nothing. The terminal takes the
 * image out of the event instead and hands it to the upload that puts the
 * file on the host (05).
 *
 * The browser's `type` only decides whether to try: the API judges the image
 * by its bytes. A transfer carrying text as well as an image (a copy from a
 * web page) is taken as the image — the text is usually its alt or its URL.
 */
export function imageFromTransfer(transfer: DataTransfer | null): File | null {
  if (!transfer) return null;
  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind !== 'file' || !isSessionImageType(item.type)) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  // A drop from the file manager lists its files here, sometimes with no items.
  for (const file of Array.from(transfer.files ?? [])) {
    if (isSessionImageType(file.type)) return file;
  }
  return null;
}

/** Whether a drag is carrying files at all, so the pane can accept the drop. */
export function carriesFiles(transfer: DataTransfer | null): boolean {
  return Array.from(transfer?.types ?? []).includes('Files');
}

function isSessionImageType(type: string): boolean {
  return (SESSION_IMAGE_MEDIA_TYPES as readonly string[]).includes(type);
}
