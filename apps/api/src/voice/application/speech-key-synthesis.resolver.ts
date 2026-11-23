import { Inject, Injectable } from '@nestjs/common';
import type { SpeechSynthesisPort } from '../infrastructure/speech-synthesis.port';
import { SPEECH_SYNTHESIS } from '../voice.di-tokens';
import type { Synthesizer } from './synthesis-provider.port';

/**
 * The deployment's own text-to-speech server (`VOICE_TTS_*`) as a voice: one
 * for every workspace, wherever it is configured, speaking the model and
 * voice its config names. A workspace's choice of model or voice is not
 * offered for it.
 */
@Injectable()
export class SpeechKeySynthesisResolver implements Synthesizer<null> {
  readonly id = 'speech_key' as const;

  constructor(@Inject(SPEECH_SYNTHESIS) private readonly gateway: SpeechSynthesisPort) {}

  async availableFor(): Promise<boolean> {
    return this.gateway.isConfigured();
  }

  async grantFor(): Promise<null> {
    return null;
  }

  synthesize(text: string): Promise<Buffer> {
    return this.gateway.synthesize(text);
  }
}
