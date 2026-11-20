import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { SpeechSynthesisPort } from '../../infrastructure/speech-synthesis.port';
import { SPEECH_SYNTHESIS } from '../../voice.di-tokens';
import { FindSpeechSynthesisQuery } from './find-speech-synthesis.query';

/**
 * Whether a voice note can be spoken here, read from config alone: a bot's
 * tool asks it before raising a card, so a deployment without speech refuses
 * the call at once instead of after the owner said yes. It spends nothing.
 */
@QueryHandler(FindSpeechSynthesisQuery)
export class FindSpeechSynthesisQueryHandler
  implements IQueryHandler<FindSpeechSynthesisQuery, boolean>
{
  constructor(@Inject(SPEECH_SYNTHESIS) private readonly speech: SpeechSynthesisPort) {}

  async execute(): Promise<boolean> {
    return this.speech.isConfigured();
  }
}
