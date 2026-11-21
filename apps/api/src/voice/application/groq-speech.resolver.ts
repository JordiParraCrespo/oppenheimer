import { Inject, Injectable } from '@nestjs/common';
import type {
  TurnCredential,
  TurnCredentialsPort,
} from '../../bots/application/turn-credentials.port';
import { TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import type { VoiceClip } from '../infrastructure/speech-to-text.port';
import type { GroqSpeechPort } from '../infrastructure/workspace-speech.port';
import { GROQ_SPEECH } from '../voice.di-tokens';
import type { SpeechGrant, SpeechProvider } from './speech-provider.port';

/**
 * A workspace's Groq key (Settings → Model providers) as a speech provider,
 * read through the bots module's `TURN_CREDENTIALS`. Groq runs no bot here,
 * so it brings no model for the polish.
 */
@Injectable()
export class GroqSpeechResolver implements SpeechProvider<TurnCredential> {
  readonly id = 'groq' as const;

  constructor(
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
    @Inject(GROQ_SPEECH) private readonly gateway: GroqSpeechPort,
  ) {}

  availableFor(organizationId: string): Promise<boolean> {
    return this.credentials.has(organizationId, 'groq');
  }

  async grantFor(organizationId: string, now: Date): Promise<SpeechGrant<TurnCredential>> {
    return { access: await this.credentials.forTurn(organizationId, 'groq', now), polishOn: null };
  }

  transcribe(clip: VoiceClip, { access }: SpeechGrant<TurnCredential>): Promise<string> {
    return this.gateway.transcribe(clip, access.apiKey);
  }
}
