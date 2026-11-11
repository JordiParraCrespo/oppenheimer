import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { InboxMarkRepositoryPort } from '../../database/inbox-mark.repository.port';
import { InboxErrors } from '../../domain/inbox.errors';
import { InboxMarkEntity } from '../../domain/inbox-mark.entity';
import { inboxMarkProblem, isInboxItemKey } from '../../domain/inbox-mark.policy';
import { INBOX_MARK_REPOSITORY } from '../../inbox.di-tokens';
import { PutInboxMarksCommand } from './put-inbox-marks.command';

/**
 * A bulk action from the Inbox (`product/versions/mvp/29-inbox.md`, "Bulk
 * actions"): the same mark on every occurrence of a selection, or each one's
 * mark cleared. Every key and the snooze's end are checked before anything is
 * written, and the marks are written in one transaction, so a selection is
 * never left half marked; each mark carries its own event, as a single put or
 * delete would.
 */
@CommandHandler(PutInboxMarksCommand)
export class PutInboxMarksCommandHandler implements ICommandHandler<PutInboxMarksCommand, void> {
  constructor(@Inject(INBOX_MARK_REPOSITORY) private readonly marks: InboxMarkRepositoryPort) {}

  async execute(command: PutInboxMarksCommand): Promise<void> {
    const { organizationId, userId, itemKeys, mark, until } = command;
    requireOrganization(organizationId);
    const now = new Date();
    for (const itemKey of itemKeys) {
      if (!isInboxItemKey(itemKey)) {
        throw new AppError(InboxErrors.INVALID_ITEM_KEY, {
          detail: `${itemKey} is not an item key`,
        });
      }
      if (mark !== null && inboxMarkProblem({ itemKey, mark, until }, now) === 'until_past') {
        throw new AppError(InboxErrors.SNOOZE_NOT_IN_FUTURE, {
          detail: `${until?.toISOString()} is not after ${now.toISOString()}`,
        });
      }
    }

    // In one order, so two overlapping batches lock their rows alike.
    const keys = [...new Set(itemKeys)].sort();
    if (mark === null) {
      await this.marks.clear(organizationId, userId, keys);
      return;
    }
    await this.marks.upsertAll(
      keys.map((itemKey) =>
        InboxMarkEntity.place({ organizationId, userId, itemKey, mark, until }, now),
      ),
    );
  }
}
