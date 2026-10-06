import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { PullRequestAddress } from '../../../github/application/pull-request-access.port';

export class FindPullRequestCommentsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly address: PullRequestAddress;

  constructor(props: { scope: AccessScope; address: PullRequestAddress }) {
    super();
    this.scope = props.scope;
    this.address = props.address;
  }
}
