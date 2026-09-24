import { usePasteSessionImage } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-web';

/**
 * An image pasted or dropped onto a session's terminal, on its way to the
 * host: the upload, whether it is still going, and what to tell the reader
 * when it did not arrive.
 *
 * Success says nothing here — it is the image's path appearing in the
 * agent's prompt, which the terminal already shows. Every refusal, including
 * a file over the cap that never leaves the browser, is the mutation's error.
 */
export function useImagePaste(sessionId: string, window: number) {
  const resolveError = useErrorMessage();
  const paste = usePasteSessionImage(sessionId, window);

  return {
    onImage: (image: File) => paste.mutate(image),
    sending: paste.isPending,
    failure: paste.error ? resolveError(paste.error).message : null,
    dismiss: () => paste.reset(),
  };
}
