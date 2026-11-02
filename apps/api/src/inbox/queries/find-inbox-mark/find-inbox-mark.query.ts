import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindInboxMarkQuery extends QueryBase {
  constructor(
    readonly organizationId: string,
    readonly userId: string,
    readonly itemKey: string,
  ) {
    super();
  }
}
