'use client';

import { useQuery } from '@oppenheimer/frontend-core/react';
import type { VoiceStatusDto } from '@oppenheimer/shared/schemas/voice';
import { type UseMutationOptions, type UseQueryOptions, useMutation } from '@tanstack/react-query';
import type { VoiceTranscription } from '../modules/voice';
import { useConsumerApp } from './context';

export const voiceKeys = {
  all: ['voice'] as const,
  status: () => [...voiceKeys.all, 'status'] as const,
};

/**
 * Whether the workspace can dictate (`GET /voice/status`). A sign-in or key
 * changed in Settings changes the answer, so those mutations invalidate it
 * with the provider list (`invalidateModelProviders`); a reader that needs
 * only the yes or no narrows it with `select`.
 */
export function useVoiceStatus<TData = VoiceStatusDto>(
  options?: Omit<UseQueryOptions<VoiceStatusDto, Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<VoiceStatusDto, Error, TData>({
    queryKey: voiceKeys.status(),
    queryFn: () => app.voice.status(),
    ...options,
  });
}

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
