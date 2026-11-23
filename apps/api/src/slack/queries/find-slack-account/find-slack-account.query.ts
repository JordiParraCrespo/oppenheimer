import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindSlackAccountQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly accountId: string;

  constructor(props: { scope: AccessScope; accountId: string }) {
    super();
    this.scope = props.scope;
    this.accountId = props.accountId;
  }
}
