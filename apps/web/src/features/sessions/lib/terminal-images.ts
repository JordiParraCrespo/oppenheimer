import { SESSION_IMAGE_MEDIA_TYPES } from '@oppenheimer/shared/protocol';

/**
 * The image in a paste, if any. The agent reads its host's
 * clipboard, never the browser's, so the terminal takes the image out of the
 * event for the upload that puts it on the host (05). The browser's `type`
 * only decides whether to try; the API judges the bytes. A transfer with text
 * as well (a copy from a web page) is taken as the image, since the text is
 * usually its alt or URL.
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

/**
 * The dropped files an agent can read, in the order they came: the images the
 * pane's drop zone hands on to the upload. Anything else in the drop (a PDF, a
 * folder) is left out, as a paste of it would be.
 */
export function imagesIn(files: File[]): File[] {
  return files.filter((file) => isSessionImageType(file.type));
}

function isSessionImageType(type: string): boolean {
  return (SESSION_IMAGE_MEDIA_TYPES as readonly string[]).includes(type);
}

/**
 * Listen for images pasted onto `container` and hand each to `onImage`;
 * returns the function that stops listening. A drop is the pane's
 * `DropZone`, which draws the outline as it comes.
 *
 * The paste is caught on the way down (capture), before xterm's own handler
 * on its textarea: xterm would paste an image as nothing, or as the text
 * copied beside it. A paste without an image is left alone.
 */
export function bindImagePaste(container: HTMLElement, onImage: (image: File) => void): () => void {
  const onPaste = (event: ClipboardEvent) => {
    const image = imageFromTransfer(event.clipboardData);
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    onImage(image);
  };
  container.addEventListener('paste', onPaste, { capture: true });
  return () => container.removeEventListener('paste', onPaste, { capture: true });
}
