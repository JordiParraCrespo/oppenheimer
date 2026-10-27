import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { InboxMarkRepositoryPort } from '../../database/inbox-mark.repository.port';
import { InboxErrors } from '../../domain/inbox.errors';
import { InboxMarkEntity } from '../../domain/inbox-mark.entity';
import { inboxMarkProblem } from '../../domain/inbox-mark.policy';
import { INBOX_MARK_REPOSITORY } from '../../inbox.di-tokens';
import { PutInboxMarkCommand } from './put-inbox-mark.command';

/**
 * Marks an occurrence for the caller, replacing what they had on it
 * (`product/versions/mvp/29-inbox.md` §3). Answers the occurrence's key: a
 * mark is read back by it, never by id.
 */
@CommandHandler(PutInboxMarkCommand)
export class PutInboxMarkCommandHandler implements ICommandHandler<PutInboxMarkCommand, string> {
  constructor(@Inject(INBOX_MARK_REPOSITORY) private readonly marks: InboxMarkRepositoryPort) {}

  async execute(command: PutInboxMarkCommand): Promise<string> {
    const { organizationId, userId, itemKey, mark, until } = command;
    if (!organizationId) throw new AppError(InboxErrors.NO_ACTIVE_ORGANIZATION);
    const now = new Date();
    const problem = inboxMarkProblem({ itemKey, mark, until }, now);
    if (problem === 'item_key') {
      throw new AppError(InboxErrors.INVALID_ITEM_KEY, { detail: `${itemKey} is not an item key` });
    }
    if (problem === 'until_past') {
      throw new AppError(InboxErrors.SNOOZE_NOT_IN_FUTURE, {
        detail: `${until?.toISOString()} is not after ${now.toISOString()}`,
      });
    }
    await this.marks.upsert(
      InboxMarkEntity.place({ organizationId, userId, itemKey, mark, until }, now),
    );
    return itemKey;
  }
}
