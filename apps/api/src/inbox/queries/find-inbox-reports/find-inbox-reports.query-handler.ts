import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { INBOX_REPORTS_MAX } from '@oppenheimer/shared';
import type { InboxReportRepositoryPort } from '../../database/inbox-report.repository.port';
import type { InboxReportEntity } from '../../domain/inbox-report.entity';
import { INBOX_REPORT_REPOSITORY } from '../../inbox.di-tokens';
import { FindInboxReportsQuery } from './find-inbox-reports.query';

/** The workspace's reports in one status, the newest first. */
@QueryHandler(FindInboxReportsQuery)
export class FindInboxReportsQueryHandler
  implements IQueryHandler<FindInboxReportsQuery, InboxReportEntity[]>
{
  constructor(
    @Inject(INBOX_REPORT_REPOSITORY) private readonly reports: InboxReportRepositoryPort,
  ) {}

  async execute({ organizationId, status }: FindInboxReportsQuery): Promise<InboxReportEntity[]> {
    requireOrganization(organizationId);
    return this.reports.findByStatus(organizationId, status, INBOX_REPORTS_MAX);
  }
}
