import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { PullRequestScope } from '@oppenheimer/shared';

export class FindPullRequestsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly queue: PullRequestScope;

  constructor(props: { scope: AccessScope; queue: PullRequestScope }) {
    super();
    this.scope = props.scope;
    this.queue = props.queue;
  }
}
