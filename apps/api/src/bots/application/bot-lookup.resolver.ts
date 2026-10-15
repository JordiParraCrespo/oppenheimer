import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { BotDocumentName } from '@oppenheimer/shared';
import { BOT_REPOSITORY } from '../bots.di-tokens';
import type { BotRepositoryPort } from '../database/bot.repository.port';
import type { BotEntity } from '../domain/bot.entity';
import { isBotDocumentName } from '../domain/bot-document.entity';
import { BotErrors } from '../domain/bots.errors';

/**
 * What every route under `/bots/:id` asks first: the bot, through the caller's
 * scope, so a bot in another workspace is one that does not exist; and, for
 * the document routes, a document name that is one of the two.
 */
@Injectable()
export class BotLookupResolver {
  constructor(
    @Inject(BOT_REPOSITORY)
    private readonly bots: BotRepositoryPort,
  ) {}

  async bot(scope: AccessScope, botId: string): Promise<BotEntity> {
    return requireFound(await this.bots.findOneById(scope, botId), BotErrors.NOT_FOUND, {
      detail: `No bot with id ${botId}`,
    });
  }

  documentName(name: string): BotDocumentName {
    if (!isBotDocumentName(name)) {
      throw new AppError(BotErrors.DOCUMENT_NOT_FOUND, {
        detail: `A bot's documents are soul and instructions, not ${name}`,
      });
    }
    return name;
  }
}
