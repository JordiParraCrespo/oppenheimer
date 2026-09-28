import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindAccessGrantsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly page: number;
  readonly limit: number;

  constructor(props: { scope: AccessScope; page: number; limit: number }) {
    super();
    this.scope = props.scope;
    this.page = props.page;
    this.limit = props.limit;
  }
}
