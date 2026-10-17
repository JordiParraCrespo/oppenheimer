import { Inject, Injectable } from '@nestjs/common';
import type { KeyedSpeechPort, VoiceClip } from '../infrastructure/speech-to-text.port';
import { KEYED_SPEECH } from '../voice.di-tokens';
import type { SpeechGrant, SpeechProvider } from './speech-provider.port';

/**
 * The deployment's own speech-to-text server (`VOICE_STT_*`) as a speech
 * provider: one key for every workspace, available wherever it is
 * configured. It brings no model credential, so the polish runs on the
 * deployment's LLM.
 */
@Injectable()
export class SpeechKeyResolver implements SpeechProvider<null> {
  readonly id = 'speech_key' as const;

  constructor(@Inject(KEYED_SPEECH) private readonly gateway: KeyedSpeechPort) {}

  async availableFor(): Promise<boolean> {
    return this.gateway.isConfigured();
  }

  async grantFor(): Promise<SpeechGrant<null>> {
    return { access: null, polishOn: null };
  }

  transcribe(clip: VoiceClip): Promise<string> {
    return this.gateway.transcribe(clip);
  }
}
