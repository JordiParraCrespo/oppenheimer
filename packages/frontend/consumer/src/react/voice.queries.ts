'use client';

import { type UseMutationOptions, useMutation } from '@tanstack/react-query';
import type { VoiceTranscription } from '../modules/voice';
import { useConsumerApp } from './context';

export interface TranscribeVoiceVariables {
  /** The recording, as the WAV the kit's `useDictation` hands over. */
  audio: Blob;
  /** The names the screen shows, for the tidy to spell as written. */
  vocabulary?: readonly string[];
}

/**
 * Transcribe one dictation. Nothing is cached: the answer is text for the
 * field the person dictated into, and nothing else on screen reads it.
 */
export function useTranscribeVoice(
  options?: UseMutationOptions<VoiceTranscription, Error, TranscribeVoiceVariables>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: ({ audio, vocabulary }: TranscribeVoiceVariables) =>
      app.voice.transcribe(audio, { vocabulary }),
    ...options,
  });
}
