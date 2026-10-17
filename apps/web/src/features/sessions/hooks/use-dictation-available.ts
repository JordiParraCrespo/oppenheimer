import { useVoiceStatus } from '@oppenheimer/frontend-consumer/react';
import { useFeatureFlag } from '@oppenheimer/frontend-core/react';

/**
 * Whether New session offers the mic: dictation is on (`voice_dictation`)
 * and the API says some speech provider can hear this workspace
 * (`GET /voice/status`, which asks every provider it knows). Narrowed to a
 * boolean, so a refetch re-renders the composer only when the answer flips.
 */
export function useDictationAvailable(): boolean {
  const enabled = useFeatureFlag('voice_dictation');
  const { data: available } = useVoiceStatus({
    enabled,
    select: (status) => status.available,
  });
  return enabled && available === true;
}
