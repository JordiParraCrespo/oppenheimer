import { QueryBase } from '@oppenheimer/backend-ddd';

export class ReadInboxReportImageQuery extends QueryBase {
  constructor(
    /** The request's workspace; null when it acts in none. */
    readonly organizationId: string | null,
    readonly reportId: string,
    readonly imageId: string,
  ) {
    super();
  }
}
