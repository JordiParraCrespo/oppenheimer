import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindPairingTokensQuery extends QueryBase {
  readonly scope: AccessScope;

  constructor(props: { scope: AccessScope }) {
    super();
    this.scope = props.scope;
  }
}
