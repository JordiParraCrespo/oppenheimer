import { usePasteSessionImage } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { imagesIn } from '../lib/session-images';

type Batch = { sending: boolean; failure: Error | null; refused: boolean };

const IDLE: Batch = { sending: false, failure: null, refused: false };

/**
 * Files pasted or dropped onto a session's terminal, on their way to the
 * host as one batch: whether it is still going, and what to tell the reader
 * when it did not all arrive.
 *
 * `send` takes everything the gesture carried and keeps what `imagesIn`
 * keeps, the rule every gesture and both panes share. The images go one
 * after another, so their paths land in the prompt in the order they were
 * dropped, and the batch owns its own state: one upload's outcome never
 * hides another's. The first failure is the one reported; a gesture that
 * carried files but no image is `refused`, rather than nothing happening.
 *
 * Success says nothing here — it is the paths appearing in the agent's
 * prompt, which the terminal already shows.
 */
export function useImagePaste(sessionId: string, window: number) {
  const paste = usePasteSessionImage(sessionId, window);
  const [batch, setBatch] = useState<Batch>(IDLE);

  async function send(files: File[]) {
    if (files.length === 0) return;
    const images = imagesIn(files);
    if (images.length === 0) {
      setBatch({ ...IDLE, refused: true });
      return;
    }
    setBatch({ ...IDLE, sending: true });
    let failure: Error | null = null;
    for (const image of images) {
      try {
        await paste.mutateAsync(image);
      } catch (error) {
        if (!failure) failure = error instanceof Error ? error : new Error(String(error));
      }
    }
    setBatch({ ...IDLE, failure });
  }

  return {
    send,
    sending: batch.sending,
    failure: batch.failure,
    refused: batch.refused,
    dismiss: () => setBatch(IDLE),
  };
}
