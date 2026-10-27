import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindInboxMarksQuery extends QueryBase {
  constructor(
    /** The request's workspace; null when it acts in none. */
    readonly organizationId: string | null,
    readonly userId: string,
  ) {
    super();
  }
}
