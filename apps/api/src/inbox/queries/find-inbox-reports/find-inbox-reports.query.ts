import { QueryBase } from '@oppenheimer/backend-ddd';
import type { InboxReportStatus } from '@oppenheimer/shared';

export class FindInboxReportsQuery extends QueryBase {
  constructor(
    /** The request's workspace; null when it acts in none. */
    readonly organizationId: string | null,
    readonly status: InboxReportStatus,
  ) {
    super();
  }
}
