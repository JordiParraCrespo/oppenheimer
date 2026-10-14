import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_DOCUMENT_REPOSITORY } from '../../bots.di-tokens';
import type { BotDocumentRepositoryPort } from '../../database/bot-document.repository.port';
import { userActor } from '../../domain/bot.types';
import { BotErrors } from '../../domain/bots.errors';
import { RevertBotDocumentCommand } from './revert-bot-document.command';

/**
 * Go back to an earlier revision by writing its content as the next one, so
 * the history keeps what is being reverted. Reverting to what is already
 * current makes no revision.
 */
@CommandHandler(RevertBotDocumentCommand)
export class RevertBotDocumentCommandHandler
  implements ICommandHandler<RevertBotDocumentCommand, AggregateID>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_DOCUMENT_REPOSITORY)
    private readonly documents: BotDocumentRepositoryPort,
  ) {}

  async execute({ scope, botId, name, revision }: RevertBotDocumentCommand): Promise<AggregateID> {
    const documentName = this.lookup.documentName(name);
    const bot = await this.lookup.bot(scope, botId);
    const document = requireFound(
      await this.documents.findOne(scope, bot.id, documentName),
      BotErrors.DOCUMENT_NOT_FOUND,
    );
    const target = requireFound(
      await this.documents.findRevision(scope, bot.id, documentName, revision),
      BotErrors.REVISION_NOT_FOUND,
      { detail: `${documentName} has no revision ${revision}` },
    );
    if (
      document.revertTo(target, userActor(scope.userId)) === 'written' &&
      (await this.documents.save(document)) === 'conflict'
    ) {
      throw new AppError(BotErrors.DOCUMENT_CONFLICT, {
        detail: `${documentName} was saved by someone else at the same time`,
      });
    }
    return bot.id;
  }
}
