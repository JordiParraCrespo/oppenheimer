import { usePasteSessionImage } from '@oppenheimer/frontend-consumer/react';
import { notifySuccess, useErrorMessage } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * An image pasted or dropped onto a session's terminal, on its way to the
 * host: the upload, whether it is still going, and what to tell the reader
 * when it did not arrive.
 *
 * Success toasts: the image's path does appear in the agent's prompt, but
 * the terminal only says "sending…" while it goes, and a path typed into a
 * busy prompt is easy to miss. Every refusal, including
 * a file over the cap that never leaves the browser, is the mutation's error.
 */
export function useImagePaste(sessionId: string, window: number) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const paste = usePasteSessionImage(sessionId, window, {
    onSuccess: () => notifySuccess(t('toasts.imageSent')),
  });

  return {
    onImage: (image: File) => paste.mutate(image),
    sending: paste.isPending,
    failure: paste.error ? resolveError(paste.error).message : null,
    dismiss: () => paste.reset(),
  };
}
