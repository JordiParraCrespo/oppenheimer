import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindHostsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly includeUnpaired: boolean;

  constructor(props: { scope: AccessScope; includeUnpaired?: boolean }) {
    super();
    this.scope = props.scope;
    this.includeUnpaired = props.includeUnpaired ?? false;
  }
}
