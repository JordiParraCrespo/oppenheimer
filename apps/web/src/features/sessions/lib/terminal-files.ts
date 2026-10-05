import { filesIn, sessionFilesIn } from './session-files';

/**
 * Listen for files pasted onto `container` and hand them to `onFiles`;
 * returns the function that stops listening. The agent reads its host's
 * clipboard, never the browser's, so the terminal takes the files out of
 * the event for the upload that puts them on the host (05). Which files
 * count is `sessionFilesIn`, the rule every gesture shares; a transfer with
 * text as well (a copy from a web page) is taken as its files, since the
 * text is usually their alt or URL.
 *
 * The paste is caught on the way down (capture), before xterm's own handler
 * on its textarea: xterm would paste a file as nothing, or as the text
 * copied beside it. A paste without a file is left to xterm.
 */
export function bindFilePaste(
  container: HTMLElement,
  onFiles: (files: File[]) => void,
): () => void {
  const onPaste = (event: ClipboardEvent) => {
    const files = sessionFilesIn(filesIn(event.clipboardData));
    if (files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onFiles(files);
  };
  container.addEventListener('paste', onPaste, { capture: true });
  return () => container.removeEventListener('paste', onPaste, { capture: true });
}
