import { filesIn, sessionFilesIn } from './session-files';

/** What `takeFilePaste` reads off a paste: the DOM's event and React's both fit. */
interface PasteEvent {
  clipboardData: DataTransfer | null;
  preventDefault(): void;
  stopPropagation(): void;
}

/**
 * Takes a paste's files for the session: the ones `sessionFilesIn` keeps go
 * to `onFiles`, and the paste goes no further, so the field it landed in
 * (xterm's textarea, the chat's composer) inserts nothing for it. The agent
 * reads its host's clipboard, never the browser's, so the files are taken out
 * of the event for the upload that puts them on the host (05). A transfer
 * with text as well (a copy from a web page) is taken as its files, since the
 * text is usually their alt or URL. A paste without a file is left alone.
 */
export function takeFilePaste(event: PasteEvent, onFiles: (files: File[]) => void): void {
  const files = sessionFilesIn(filesIn(event.clipboardData));
  if (files.length === 0) return;
  event.preventDefault();
  event.stopPropagation();
  onFiles(files);
}

/**
 * Listen for files pasted onto `container` and hand them to `onFiles`
 * (`takeFilePaste`); returns the function that stops listening.
 *
 * The paste is caught on the way down (capture), before xterm's own handler
 * on its textarea: xterm would paste a file as nothing, or as the text
 * copied beside it.
 */
export function bindFilePaste(
  container: HTMLElement,
  onFiles: (files: File[]) => void,
): () => void {
  const onPaste = (event: ClipboardEvent) => takeFilePaste(event, onFiles);
  container.addEventListener('paste', onPaste, { capture: true });
  return () => container.removeEventListener('paste', onPaste, { capture: true });
}
