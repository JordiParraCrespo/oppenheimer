import { Inject, Injectable } from '@nestjs/common';
import type {
  TurnCredential,
  TurnCredentialsPort,
} from '../../bots/application/turn-credentials.port';
import { TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import type { VoiceClip } from '../infrastructure/speech-to-text.port';
import type { OpenAiSpeechPort } from '../infrastructure/workspace-speech.port';
import { OPENAI_SPEECH } from '../voice.di-tokens';
import type { SpeechGrant, SpeechProvider } from './speech-provider.port';

/**
 * A workspace's OpenAI key (Settings → Model providers) as a speech provider,
 * read through the bots module's `TURN_CREDENTIALS` like a bot's turn reads
 * it. The same key is what the polish runs on.
 */
@Injectable()
export class OpenAiSpeechResolver implements SpeechProvider<TurnCredential> {
  readonly id = 'openai' as const;

  constructor(
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
    @Inject(OPENAI_SPEECH) private readonly gateway: OpenAiSpeechPort,
  ) {}

  availableFor(organizationId: string): Promise<boolean> {
    return this.credentials.has(organizationId, 'openai');
  }

  async grantFor(organizationId: string, now: Date): Promise<SpeechGrant<TurnCredential>> {
    const access = await this.credentials.forTurn(organizationId, 'openai', now);
    return { access, polishOn: { provider: 'openai', credential: access } };
  }

  transcribe(clip: VoiceClip, { access }: SpeechGrant<TurnCredential>): Promise<string> {
    return this.gateway.transcribe(clip, access.apiKey);
  }
}
