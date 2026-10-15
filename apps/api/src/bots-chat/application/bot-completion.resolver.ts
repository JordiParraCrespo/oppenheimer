import { Inject, Injectable } from '@nestjs/common';
import type { BotCompletionRequest } from '@oppenheimer/backend-agents';
import { botDefaultModel } from '@oppenheimer/shared';
import {
  BOT_REPOSITORY,
  MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
  PROVIDER_KEY_SEALER,
} from '../../bots/bots.di-tokens';
import type { BotRepositoryPort } from '../../bots/database/bot.repository.port';
import type { ModelProviderCredentialRepositoryPort } from '../../bots/database/model-provider-credential.repository.port';
import type { ProviderKeySealerPort } from '../../bots/infrastructure/provider-key-sealer.port';

/** What a completion for a bot runs on: its provider, its model, and the workspace's key, opened. */
export type BotCompletionTarget = Pick<BotCompletionRequest, 'provider' | 'model' | 'apiKey'>;

/**
 * The bot's own provider and model as they are now (its default model when
 * it has picked none), and the workspace's key for that provider, read in
 * the bot's workspace; null when the bot is gone or no key can be opened.
 * What a summary of its conversation is written with, so it runs on what
 * the owner chose and pays for, and nothing else.
 */
@Injectable()
export class BotCompletionResolver {
  constructor(
    @Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
  ) {}

  async resolve(organizationId: string, botId: string): Promise<BotCompletionTarget | null> {
    const found = await this.bots.findForTurn(organizationId, botId);
    if (found.isNone()) return null;
    const bot = found.unwrap();
    const stored = await this.credentials.findForRun(organizationId, bot.provider);
    if (stored.isNone() || !this.sealer.isConfigured()) return null;
    return {
      provider: bot.provider,
      model: bot.model ?? botDefaultModel(bot.provider).id,
      apiKey: this.sealer.open(stored.unwrap().sealedKey),
    };
  }
}
