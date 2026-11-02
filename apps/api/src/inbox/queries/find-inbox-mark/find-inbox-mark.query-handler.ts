import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import type { InboxMarkRepositoryPort } from '../../database/inbox-mark.repository.port';
import { InboxErrors } from '../../domain/inbox.errors';
import type { InboxMarkEntity } from '../../domain/inbox-mark.entity';
import { INBOX_MARK_REPOSITORY } from '../../inbox.di-tokens';
import { FindInboxMarkQuery } from './find-inbox-mark.query';

/** The caller's mark on one occurrence, read back after a put. */
@QueryHandler(FindInboxMarkQuery)
export class FindInboxMarkQueryHandler
  implements IQueryHandler<FindInboxMarkQuery, InboxMarkEntity>
{
  constructor(@Inject(INBOX_MARK_REPOSITORY) private readonly marks: InboxMarkRepositoryPort) {}

  async execute({ organizationId, userId, itemKey }: FindInboxMarkQuery): Promise<InboxMarkEntity> {
    return requireFound(
      await this.marks.findOne(organizationId, userId, itemKey),
      InboxErrors.MARK_NOT_FOUND,
      { detail: `No mark on ${itemKey}` },
    );
  }
}
