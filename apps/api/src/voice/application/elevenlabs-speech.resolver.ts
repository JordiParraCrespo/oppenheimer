import { Inject, Injectable } from '@nestjs/common';
import type {
  TurnCredential,
  TurnCredentialsPort,
} from '../../bots/application/turn-credentials.port';
import { TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import type { VoiceClip } from '../infrastructure/speech-to-text.port';
import type { ElevenlabsSpeechPort } from '../infrastructure/workspace-speech.port';
import { ELEVENLABS_SPEECH } from '../voice.di-tokens';
import type { SpeechGrant, SpeechProvider } from './speech-provider.port';

/**
 * A workspace's ElevenLabs key (Settings → Model providers) as a speech provider,
 * read through the bots module's `TURN_CREDENTIALS`. ElevenLabs runs no bot,
 * so it brings no model for the polish.
 */
@Injectable()
export class ElevenlabsSpeechResolver implements SpeechProvider<TurnCredential> {
  readonly id = 'elevenlabs' as const;

  constructor(
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
    @Inject(ELEVENLABS_SPEECH) private readonly gateway: ElevenlabsSpeechPort,
  ) {}

  availableFor(organizationId: string): Promise<boolean> {
    return this.credentials.has(organizationId, 'elevenlabs');
  }

  async grantFor(organizationId: string, now: Date): Promise<SpeechGrant<TurnCredential>> {
    return {
      access: await this.credentials.forTurn(organizationId, 'elevenlabs', now),
      polishOn: null,
    };
  }

  transcribe(clip: VoiceClip, { access }: SpeechGrant<TurnCredential>): Promise<string> {
    return this.gateway.transcribe(clip, access.apiKey);
  }
}
