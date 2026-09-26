import { SESSION_IMAGE_MEDIA_TYPES } from '@oppenheimer/shared/protocol';

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

/**
 * Listen for images pasted or dropped onto `container` and hand each to
 * `onImage`; returns the function that stops listening.
 *
 * The paste is caught on the way down (capture), before xterm's own handler
 * on its textarea: xterm would paste an image as nothing, or as the text
 * copied beside it. A paste or a drop without an image is left alone.
 */
export function bindImageGestures(
  container: HTMLElement,
  onImage: (image: File) => void,
): () => void {
  const onPaste = (event: ClipboardEvent) => {
    const image = imageFromTransfer(event.clipboardData);
    if (!image) return;
    event.preventDefault();
    event.stopPropagation();
    onImage(image);
  };
  const onDragOver = (event: DragEvent) => {
    if (!carriesFiles(event.dataTransfer)) return;
    // Without this the browser opens the dropped file in the tab.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (event: DragEvent) => {
    if (!carriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    const image = imageFromTransfer(event.dataTransfer);
    if (image) onImage(image);
  };
  container.addEventListener('paste', onPaste, { capture: true });
  container.addEventListener('dragover', onDragOver);
  container.addEventListener('drop', onDrop);
  return () => {
    container.removeEventListener('paste', onPaste, { capture: true });
    container.removeEventListener('dragover', onDragOver);
    container.removeEventListener('drop', onDrop);
  };
}
