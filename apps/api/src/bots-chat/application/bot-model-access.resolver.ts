import { Inject, Injectable } from '@nestjs/common';
import type { BotCompletionRequest, BotProvider } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import { botDefaultModel } from '@oppenheimer/shared';
import {
  BOT_REPOSITORY,
  MODEL_PROVIDER_CREDENTIAL_REPOSITORY,
  PROVIDER_KEY_SEALER,
} from '../../bots/bots.di-tokens';
import type { BotRepositoryPort } from '../../bots/database/bot.repository.port';
import type { ModelProviderCredentialRepositoryPort } from '../../bots/database/model-provider-credential.repository.port';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { BotErrors } from '../../bots/domain/bots.errors';
import type { ProviderKeySealerPort } from '../../bots/infrastructure/provider-key-sealer.port';

/** What a call for a bot runs on: a provider, a model, and the workspace's key for it, opened. */
export type BotModelTarget = Pick<BotCompletionRequest, 'provider' | 'model' | 'apiKey'>;

/**
 * The one place a model call for a bot gets its bot and its key: the bot read
 * in the run's workspace (never another's), and the workspace's key for a
 * provider, opened. It fails closed: no stored key, or a sealer that cannot
 * open one, is no key. A turn reads both as it was sent (`bot`, `apiKey`); a
 * summary of the conversation runs on the bot's own provider and model as
 * they are now, its default model when it has picked none (`ownModel`).
 */
@Injectable()
export class BotModelAccessResolver {
  constructor(
    @Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort,
    @Inject(MODEL_PROVIDER_CREDENTIAL_REPOSITORY)
    private readonly credentials: ModelProviderCredentialRepositoryPort,
    @Inject(PROVIDER_KEY_SEALER) private readonly sealer: ProviderKeySealerPort,
  ) {}

  /** The workspace's bot; `BOTS_001` when it is gone or another workspace's. */
  async bot(organizationId: string, botId: string): Promise<BotEntity> {
    const found = await this.bots.findForTurn(organizationId, botId);
    if (found.isNone()) throw new AppError(BotErrors.NOT_FOUND);
    return found.unwrap();
  }

  /** The workspace's key for `provider`, opened; `BOTS_013` when there is none to open. */
  async apiKey(organizationId: string, provider: BotProvider): Promise<string> {
    const key = await this.openKey(organizationId, provider);
    if (key === null) throw new AppError(BotErrors.PROVIDER_KEY_MISSING);
    return key;
  }

  /** The bot's own provider, model and key; null when the bot is gone or the key cannot be opened. */
  async ownModel(organizationId: string, botId: string): Promise<BotModelTarget | null> {
    const found = await this.bots.findForTurn(organizationId, botId);
    if (found.isNone()) return null;
    const bot = found.unwrap();
    const apiKey = await this.openKey(organizationId, bot.provider);
    if (apiKey === null) return null;
    return { provider: bot.provider, model: bot.model ?? botDefaultModel(bot.provider).id, apiKey };
  }

  private async openKey(organizationId: string, provider: BotProvider): Promise<string | null> {
    const stored = await this.credentials.findForRun(organizationId, provider);
    if (stored.isNone() || !this.sealer.isConfigured()) return null;
    return this.sealer.open(stored.unwrap().sealedKey);
  }
}
