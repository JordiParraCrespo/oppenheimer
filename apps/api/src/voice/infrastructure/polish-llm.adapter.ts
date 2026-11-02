import { Inject, Injectable } from '@nestjs/common';
import { type BotEngine, engineLlm } from '@oppenheimer/backend-agents';
import { LlmService } from '@oppenheimer/backend-llm';
import { botDefaultModel } from '@oppenheimer/shared';
import type { PolishModel } from '../application/speech-provider.port';
import { VOICE_POLISH_ENGINE } from '../voice.di-tokens';
import type { PolishLlmPort } from './polish-llm.port';

/**
 * {@link PolishLlmPort} over the two model stacks. A provider's credential
 * runs on the bot engine at its provider's default model, with low effort:
 * tidying is not reasoning, and a model that takes no effort setting ignores
 * it. No credential, and it is the deployment's `LlmService`.
 */
@Injectable()
export class PolishLlmAdapter implements PolishLlmPort {
  constructor(
    @Inject(VOICE_POLISH_ENGINE) private readonly engine: BotEngine,
    private readonly deployment: LlmService,
  ) {}

  for(model: PolishModel | null): LlmService {
    if (!model) return this.deployment;
    return engineLlm(this.engine, {
      provider: model.provider,
      apiKey: model.credential.apiKey,
      accountId: model.credential.accountId,
      model: botDefaultModel(model.provider).id,
      effort: 'low',
    });
  }
}
