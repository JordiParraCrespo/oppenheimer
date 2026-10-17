import { useModelProviders } from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities, useFeatureFlag } from '@oppenheimer/frontend-core/react';

/**
 * Whether New session offers the mic: dictation is on (`voice_dictation`)
 * and somebody can hear it — the workspace is signed in to ChatGPT, or the
 * deployment has a speech server of its own (`voice_transcription`). Each
 * read narrows to a boolean, so a refetch re-renders the composer only when
 * the answer flips.
 */
export function useDictationAvailable(): boolean {
  const enabled = useFeatureFlag('voice_dictation');
  const { data: serverKey } = useDeploymentCapabilities({
    select: (deployment) => deployment.voice_transcription,
  });
  const { data: signedIn } = useModelProviders({
    select: (providers) =>
      providers.some((provider) => provider.provider === 'chatgpt' && provider.configured),
  });
  return enabled && (serverKey === true || signedIn === true);
}
