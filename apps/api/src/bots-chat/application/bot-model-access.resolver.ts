import { Inject, Injectable } from '@nestjs/common';
import type { BotCompletionRequest, BotProvider } from '@oppenheimer/backend-agents';
import { AppError } from '@oppenheimer/backend-core';
import { botDefaultModel } from '@oppenheimer/shared';
import type {
  TurnCredential,
  TurnCredentialsPort,
} from '../../bots/application/turn-credentials.port';
import { BOT_REPOSITORY, TURN_CREDENTIALS } from '../../bots/bots.di-tokens';
import type { BotRepositoryPort } from '../../bots/database/bot.repository.port';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { BotErrors } from '../../bots/domain/bots.errors';

/** What a call for a bot runs on: a provider, a model, and the credential its provider takes. */
export type BotModelTarget = Pick<
  BotCompletionRequest,
  'provider' | 'model' | 'apiKey' | 'accountId'
>;

/**
 * The one place a model call for a bot gets its bot and its credential: the
 * bot read in the run's workspace (never another's), and the credential its
 * provider runs on, through `TurnCredentialsPort` (a workspace key, or a
 * refreshed sign-in). A turn reads both as it was sent (`bot`, `credential`);
 * a summary of the conversation runs on the bot's own provider and model as
 * they are now, its default model when it has picked none (`ownModel`).
 */
@Injectable()
export class BotModelAccessResolver {
  constructor(
    @Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort,
    @Inject(TURN_CREDENTIALS) private readonly credentials: TurnCredentialsPort,
  ) {}

  /** The workspace's bot; `BOTS_001` when it is gone or another workspace's. */
  async bot(organizationId: string, botId: string): Promise<BotEntity> {
    const found = await this.bots.findForTurn(organizationId, botId);
    if (found.isNone()) throw new AppError(BotErrors.NOT_FOUND);
    return found.unwrap();
  }

  /** The workspace's bot, or null when it is gone or another workspace's. */
  async findBot(organizationId: string, botId: string): Promise<BotEntity | null> {
    const found = await this.bots.findForTurn(organizationId, botId);
    return found.isSome() ? found.unwrap() : null;
  }

  /** The credential `provider` runs on in the workspace; `BOTS_013` when there is none. */
  credential(organizationId: string, provider: BotProvider, now: Date): Promise<TurnCredential> {
    return this.credentials.forTurn(organizationId, provider, now);
  }

  /** The bot's own provider, model and credential; null when the bot is gone or has no credential. */
  async ownModel(organizationId: string, botId: string, now: Date): Promise<BotModelTarget | null> {
    const found = await this.bots.findForTurn(organizationId, botId);
    if (found.isNone()) return null;
    const bot = found.unwrap();
    try {
      const credential = await this.credentials.forTurn(organizationId, bot.provider, now);
      return {
        provider: bot.provider,
        model: bot.model ?? botDefaultModel(bot.provider).id,
        ...credential,
      };
    } catch (error) {
      if (error instanceof AppError && error.code === BotErrors.PROVIDER_KEY_MISSING.code) {
        return null;
      }
      throw error;
    }
  }
}
