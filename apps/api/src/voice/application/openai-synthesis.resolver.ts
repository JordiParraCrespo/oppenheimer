import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type {
  TurnCredential,
  TurnCredentialsPort,
} from '../../bots/application/turn-credentials.port';
import { TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import { VoiceErrors } from '../domain/voice.errors';
import type { OpenAiSpeechPort } from '../infrastructure/workspace-speech.port';
import { OPENAI_SPEECH } from '../voice.di-tokens';
import type { SynthesisChoice, Synthesizer } from './synthesis-provider.port';

/** A workspace's OpenAI key as a voice: `gpt-4o-mini-tts` and its voices unless it chose others. */
@Injectable()
export class OpenAiSynthesisResolver implements Synthesizer<TurnCredential> {
  readonly id = 'openai' as const;

  constructor(
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
    @Inject(OPENAI_SPEECH) private readonly gateway: OpenAiSpeechPort,
  ) {}

  availableFor(organizationId: string): Promise<boolean> {
    return this.credentials.has(organizationId, 'openai');
  }

  grantFor(organizationId: string, now: Date): Promise<TurnCredential> {
    return this.credentials.forTurn(organizationId, 'openai', now);
  }

  synthesize(text: string, access: TurnCredential, choice: SynthesisChoice): Promise<Buffer> {
    if (!choice.model || !choice.voice) throw new AppError(VoiceErrors.SYNTHESIS_NOT_CONFIGURED);
    return this.gateway.synthesize(text, access.apiKey, {
      model: choice.model,
      voice: choice.voice,
    });
  }
}
