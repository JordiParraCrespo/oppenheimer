import { usePasteSessionImage } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-web';
import { SESSION_IMAGE_MAX_BYTES } from '@oppenheimer/shared/schemas/session';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * An image pasted or dropped onto a session's terminal, on its way to the
 * host: the upload, whether it is still going, and what to tell the reader
 * when it did not arrive.
 *
 * Success says nothing here — it is the image's path appearing in the
 * agent's prompt, which the terminal already shows. A file over the ceiling
 * is refused before it is sent, with the same words the API would use.
 */
export function useImagePaste(sessionId: string, window: number) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const paste = usePasteSessionImage(sessionId, window);
  const [tooLarge, setTooLarge] = useState(false);

  const onImage = (image: File) => {
    paste.reset();
    if (image.size > SESSION_IMAGE_MAX_BYTES) {
      setTooLarge(true);
      return;
    }
    setTooLarge(false);
    paste.mutate(image);
  };

  const dismiss = () => {
    setTooLarge(false);
    paste.reset();
  };

  let failure: string | null = null;
  if (tooLarge) failure = t('errors.byCode.SESSIONS_011');
  else if (paste.error) failure = resolveError(paste.error).message;
  else if (paste.data?.hostOffline) failure = t('sessions.session.image.hostOffline');

  return { onImage, sending: paste.isPending, failure, dismiss };
}
