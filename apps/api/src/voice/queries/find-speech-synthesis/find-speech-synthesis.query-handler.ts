import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SynthesisProviderRegistry } from '../../application/synthesis-provider.registry';
import { FindSpeechSynthesisQuery } from './find-speech-synthesis.query';

/**
 * Whether a voice note can be spoken for the workspace: a key it stored for a
 * provider that speaks (OpenAI, ElevenLabs), or the deployment's own server.
 * A bot's tool asks it before raising a card, so a workspace without speech
 * refuses the call at once instead of after the owner said yes. It reads rows
 * and config, and spends nothing.
 */
@QueryHandler(FindSpeechSynthesisQuery)
export class FindSpeechSynthesisQueryHandler
  implements IQueryHandler<FindSpeechSynthesisQuery, boolean>
{
  constructor(private readonly registry: SynthesisProviderRegistry) {}

  async execute({ organizationId }: FindSpeechSynthesisQuery): Promise<boolean> {
    return (await this.registry.availableFor(organizationId)).length > 0;
  }
}
