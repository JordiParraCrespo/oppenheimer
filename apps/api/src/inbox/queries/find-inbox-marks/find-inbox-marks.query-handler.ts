import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { INBOX_MARKS_MAX } from '@oppenheimer/shared';
import type { InboxMarkRepositoryPort } from '../../database/inbox-mark.repository.port';
import { InboxErrors } from '../../domain/inbox.errors';
import type { InboxMarkEntity } from '../../domain/inbox-mark.entity';
import { INBOX_MARK_REPOSITORY } from '../../inbox.di-tokens';
import { FindInboxMarksQuery } from './find-inbox-marks.query';

/**
 * The caller's marks in the workspace that still hold: a snooze whose end
 * has passed is left out, so its item is back (`29-inbox.md` §3).
 */
@QueryHandler(FindInboxMarksQuery)
export class FindInboxMarksQueryHandler
  implements IQueryHandler<FindInboxMarksQuery, InboxMarkEntity[]>
{
  constructor(@Inject(INBOX_MARK_REPOSITORY) private readonly marks: InboxMarkRepositoryPort) {}

  async execute({ organizationId, userId }: FindInboxMarksQuery): Promise<InboxMarkEntity[]> {
    if (!organizationId) throw new AppError(InboxErrors.NO_ACTIVE_ORGANIZATION);
    return this.marks.findInForce(organizationId, userId, new Date(), INBOX_MARKS_MAX);
  }
}
