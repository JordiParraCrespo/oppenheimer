import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { requireFound } from '@oppenheimer/backend-core';
import type { InboxReportRepositoryPort } from '../../database/inbox-report.repository.port';
import { InboxErrors } from '../../domain/inbox.errors';
import type { InboxReportEntity } from '../../domain/inbox-report.entity';
import { INBOX_REPORT_REPOSITORY } from '../../inbox.di-tokens';
import { FindInboxReportQuery } from './find-inbox-report.query';

/**
 * One report of the caller's workspace, with its answer once it has one:
 * what its sender polls. Another workspace's report is not found.
 */
@QueryHandler(FindInboxReportQuery)
export class FindInboxReportQueryHandler
  implements IQueryHandler<FindInboxReportQuery, InboxReportEntity>
{
  constructor(
    @Inject(INBOX_REPORT_REPOSITORY) private readonly reports: InboxReportRepositoryPort,
  ) {}

  async execute({ organizationId, reportId }: FindInboxReportQuery): Promise<InboxReportEntity> {
    requireOrganization(organizationId);
    return requireFound(
      await this.reports.findOne(organizationId, reportId),
      InboxErrors.REPORT_NOT_FOUND,
      { detail: `No report ${reportId}` },
    );
  }
}
