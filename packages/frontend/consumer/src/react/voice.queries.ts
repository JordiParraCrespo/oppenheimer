'use client';

import { useFeatureFlag, useQuery } from '@oppenheimer/frontend-core/react';
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
function useVoiceStatus<TData = VoiceStatusDto>(
  options?: Omit<UseQueryOptions<VoiceStatusDto, Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<VoiceStatusDto, Error, TData>({
    queryKey: voiceKeys.status(),
    queryFn: () => app.voice.status(),
    ...options,
  });
}

interface TranscribeVoiceVariables {
  /** The recording, as the WAV the kit's `useDictation` hands over. */
  audio: Blob;
  /** The names the screen shows, for the tidy to spell as written. */
  vocabulary?: readonly string[];
}

/**
 * Transcribe one dictation. Nothing is cached: the answer is text for the
 * field the person dictated into, and nothing else on screen reads it.
 */
function useTranscribeVoice(
  options?: UseMutationOptions<VoiceTranscription, Error, TranscribeVoiceVariables>,
) {
  const app = useConsumerApp();
  return useMutation({
    mutationFn: ({ audio, vocabulary }: TranscribeVoiceVariables) =>
      app.voice.transcribe(audio, { vocabulary }),
    ...options,
  });
}

/** What a screen hands its fields so they can take dictation; the kit's `VoiceInput`. */
export interface VoiceDictation {
  available: boolean;
  /** The recording's text, or null when it could not be transcribed. */
  transcribe: (wav: Blob) => Promise<string | null>;
}

/**
 * Dictation for a screen (`product/next-steps/voice.md`): on while
 * `voice_dictation` is and some speech provider can hear this workspace
 * (`GET /voice/status`, narrowed to a boolean so a refetch re-renders only
 * when the answer flips), and one transcription per recording. `vocabulary`
 * is read when a recording is sent: the names the screen shows, for the
 * tidy to spell as written. Every field on the screen shares the answer;
 * each says for itself what happened to its own recording.
 */
export function useVoiceDictation(vocabulary?: () => readonly string[]): VoiceDictation {
  const enabled = useFeatureFlag('voice_dictation');
  const { data: available } = useVoiceStatus({
    enabled,
    select: (status) => status.available,
  });
  const transcription = useTranscribeVoice();
  return {
    available: enabled && available === true,
    transcribe: async (wav) => {
      try {
        const heard = await transcription.mutateAsync({ audio: wav, vocabulary: vocabulary?.() });
        return heard.text;
      } catch {
        return null;
      }
    },
  };
}
