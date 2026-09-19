import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindHostQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly hostId: string;

  constructor(props: { scope: AccessScope; hostId: string }) {
    super();
    this.scope = props.scope;
    this.hostId = props.hostId;
  }
}
