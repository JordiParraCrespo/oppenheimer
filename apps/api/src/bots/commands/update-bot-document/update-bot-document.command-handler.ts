import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BotLookupResolver } from '../../application/bot-lookup.resolver';
import { BOT_DOCUMENT_REPOSITORY } from '../../bots.di-tokens';
import type { BotDocumentRepositoryPort } from '../../database/bot-document.repository.port';
import { userActor } from '../../domain/bot.types';
import { BotErrors } from '../../domain/bots.errors';
import { UpdateBotDocumentCommand } from './update-bot-document.command';

/**
 * Save a document from Settings → Instructions. It lands only over the
 * revision the editor loaded: a stale save is refused with the revision that is
 * current now, never merged and never silently winning. Saving what is already
 * there makes no revision.
 */
@CommandHandler(UpdateBotDocumentCommand)
export class UpdateBotDocumentCommandHandler
  implements ICommandHandler<UpdateBotDocumentCommand, AggregateID>
{
  constructor(
    private readonly lookup: BotLookupResolver,
    @Inject(BOT_DOCUMENT_REPOSITORY)
    private readonly documents: BotDocumentRepositoryPort,
  ) {}

  async execute({ scope, botId, name, input }: UpdateBotDocumentCommand): Promise<AggregateID> {
    const documentName = this.lookup.documentName(name);
    const bot = await this.lookup.bot(scope, botId);
    const document = requireFound(
      await this.documents.findOne(scope, bot.id, documentName),
      BotErrors.DOCUMENT_NOT_FOUND,
    );
    const outcome = document.write({
      content: input.content,
      baseRevision: input.baseRevision,
      actor: userActor(scope.userId),
      note: input.note,
    });
    if (outcome === 'stale') {
      throw new AppError(BotErrors.DOCUMENT_CONFLICT, {
        detail: `${documentName} is at revision ${document.revision}, not ${input.baseRevision}`,
        extensions: { revision: document.revision },
      });
    }
    if (outcome === 'written' && (await this.documents.save(document)) === 'conflict') {
      throw new AppError(BotErrors.DOCUMENT_CONFLICT, {
        detail: `${documentName} was saved by someone else at the same time`,
      });
    }
    return bot.id;
  }
}
