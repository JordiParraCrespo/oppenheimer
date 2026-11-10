import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { InboxReportImageMimeType } from '@oppenheimer/shared';
import { InboxErrors } from '../../domain/inbox.errors';
import type { InboxReportEntity } from '../../domain/inbox-report.entity';
import { INBOX_REPORT_FILES } from '../../inbox.di-tokens';
import type { InboxReportFilesPort } from '../../infrastructure/inbox-report-files.port';
import { FindInboxReportQuery } from '../find-inbox-report/find-inbox-report.query';
import { ReadInboxReportImageQuery } from './read-inbox-report-image.query';

export interface InboxReportImageContent {
  mimeType: InboxReportImageMimeType;
  data: Buffer;
}

/** A picture's bytes: whoever may read the report may read what it carries. */
@QueryHandler(ReadInboxReportImageQuery)
export class ReadInboxReportImageQueryHandler
  implements IQueryHandler<ReadInboxReportImageQuery, InboxReportImageContent>
{
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(INBOX_REPORT_FILES) private readonly files: InboxReportFilesPort,
  ) {}

  async execute(query: ReadInboxReportImageQuery): Promise<InboxReportImageContent> {
    const { organizationId, reportId, imageId } = query;
    const report = await this.queryBus.execute<FindInboxReportQuery, InboxReportEntity>(
      new FindInboxReportQuery(organizationId, reportId),
    );
    const image = report.images.find((candidate) => candidate.id === imageId);
    if (!image) {
      throw new AppError(InboxErrors.REPORT_NOT_FOUND, {
        detail: `Report ${reportId} carries no picture ${imageId}`,
      });
    }
    return { mimeType: image.mimeType, data: await this.files.read(image.storageKey) };
  }
}
