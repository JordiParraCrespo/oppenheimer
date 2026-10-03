import { filesIn, imagesIn } from './session-images';

/**
 * Listen for images pasted onto `container` and hand them to `onImages`;
 * returns the function that stops listening. The agent reads its host's
 * clipboard, never the browser's, so the terminal takes the images out of
 * the event for the upload that puts them on the host (05). Which files
 * count is `imagesIn`, the rule every gesture shares; a transfer with text as
 * well (a copy from a web page) is taken as its images, since the text is
 * usually their alt or URL.
 *
 * The paste is caught on the way down (capture), before xterm's own handler
 * on its textarea: xterm would paste an image as nothing, or as the text
 * copied beside it. A paste without an image is left to xterm.
 */
export function bindImagePaste(
  container: HTMLElement,
  onImages: (images: File[]) => void,
): () => void {
  const onPaste = (event: ClipboardEvent) => {
    const images = imagesIn(filesIn(event.clipboardData));
    if (images.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onImages(images);
  };
  container.addEventListener('paste', onPaste, { capture: true });
  return () => container.removeEventListener('paste', onPaste, { capture: true });
}
