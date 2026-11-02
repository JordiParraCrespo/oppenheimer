import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { InboxMarkRepositoryPort } from '../../database/inbox-mark.repository.port';
import { InboxErrors } from '../../domain/inbox.errors';
import { isInboxItemKey } from '../../domain/inbox-mark.policy';
import { INBOX_MARK_REPOSITORY } from '../../inbox.di-tokens';
import { DeleteInboxMarkCommand } from './delete-inbox-mark.command';

/**
 * Bring back, or restore priority: the caller's mark on the occurrence goes.
 * Idempotent: an occurrence with no mark is already as asked, and nothing is
 * written or announced for it.
 */
@CommandHandler(DeleteInboxMarkCommand)
export class DeleteInboxMarkCommandHandler
  implements ICommandHandler<DeleteInboxMarkCommand, void>
{
  constructor(@Inject(INBOX_MARK_REPOSITORY) private readonly marks: InboxMarkRepositoryPort) {}

  async execute({ organizationId, userId, itemKey }: DeleteInboxMarkCommand): Promise<void> {
    requireOrganization(organizationId);
    if (!isInboxItemKey(itemKey)) {
      throw new AppError(InboxErrors.INVALID_ITEM_KEY, { detail: `${itemKey} is not an item key` });
    }
    const found = await this.marks.findOne(organizationId, userId, itemKey);
    if (found.isNone()) return;
    const mark = found.unwrap();
    mark.remove();
    await this.marks.delete(mark);
  }
}
