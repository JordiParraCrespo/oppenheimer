import { AppError } from '@oppenheimer/backend-core';
import { VoiceErrors } from '../domain/voice.errors';

/** A synthesized note is refused past this size: WhatsApp takes 16 MB. */
export const AUDIO_MAX_BYTES = 16 * 1024 * 1024;

/** Reads a speech provider's answer into memory, refusing one that is too big. */
export async function readAudio(response: Response): Promise<Uint8Array> {
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > AUDIO_MAX_BYTES) {
    throw new AppError(VoiceErrors.AUDIO_TOO_LARGE, {
      detail: `The provider answered ${body.byteLength} bytes; the cap is ${AUDIO_MAX_BYTES}`,
    });
  }
  return body;
}
