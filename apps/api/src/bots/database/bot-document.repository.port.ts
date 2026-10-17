import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotDocumentName } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { BotDocumentRevision } from '../domain/bot.types';
import type { BotDocumentEntity } from '../domain/bot-document.entity';

/** `conflict`: the stored revision moved since the document was read; nothing was written. */
export type BotDocumentWriteOutcome = 'saved' | 'conflict';

export interface BotDocumentRepositoryPort {
  /** A bot's documents, soul first. */
  findAll(scope: AccessScope, botId: string): Promise<BotDocumentEntity[]>;
  /** A bot's documents, soul first, for a turn the worker runs in the bot's workspace. */
  findAllForTurn(organizationId: string, botId: string): Promise<BotDocumentEntity[]>;
  findOne(
    scope: AccessScope,
    botId: string,
    name: BotDocumentName,
  ): Promise<Option<BotDocumentEntity>>;
  /**
   * The document at its next revision and that revision's row, in one
   * transaction, conditioned on the revision it was read at.
   */
  save(document: BotDocumentEntity): Promise<BotDocumentWriteOutcome>;
  /** Newest first, at most `limit`. */
  findRevisions(
    scope: AccessScope,
    botId: string,
    name: BotDocumentName,
    limit: number,
  ): Promise<BotDocumentRevision[]>;
  findRevision(
    scope: AccessScope,
    botId: string,
    name: BotDocumentName,
    revision: number,
  ): Promise<Option<BotDocumentRevision>>;
}
