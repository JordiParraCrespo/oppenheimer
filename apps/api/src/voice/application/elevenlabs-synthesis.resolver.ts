import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type {
  TurnCredential,
  TurnCredentialsPort,
} from '../../bots/application/turn-credentials.port';
import { TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import { VoiceErrors } from '../domain/voice.errors';
import type { ElevenlabsSpeechPort } from '../infrastructure/workspace-speech.port';
import { ELEVENLABS_SPEECH } from '../voice.di-tokens';
import type { SynthesisChoice, Synthesizer } from './synthesis-provider.port';

/**
 * A workspace's ElevenLabs key as a voice: Multilingual v2 and a premade
 * voice unless it chose others, any voice its account holds included.
 */
@Injectable()
export class ElevenlabsSynthesisResolver implements Synthesizer<TurnCredential> {
  readonly id = 'elevenlabs' as const;

  constructor(
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
    @Inject(ELEVENLABS_SPEECH) private readonly gateway: ElevenlabsSpeechPort,
  ) {}

  availableFor(organizationId: string): Promise<boolean> {
    return this.credentials.has(organizationId, 'elevenlabs');
  }

  grantFor(organizationId: string, now: Date): Promise<TurnCredential> {
    return this.credentials.forTurn(organizationId, 'elevenlabs', now);
  }

  synthesize(text: string, access: TurnCredential, choice: SynthesisChoice): Promise<Buffer> {
    if (!choice.model || !choice.voice) throw new AppError(VoiceErrors.SYNTHESIS_NOT_CONFIGURED);
    return this.gateway.synthesize(text, access.apiKey, {
      model: choice.model,
      voice: choice.voice,
    });
  }
}
