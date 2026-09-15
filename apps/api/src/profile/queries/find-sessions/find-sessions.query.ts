import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindSessionsQuery extends QueryBase {
  readonly userId: string;

  constructor(userId: string) {
    super();
    this.userId = userId;
  }
}
