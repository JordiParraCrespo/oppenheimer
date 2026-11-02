import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { PullRequestQueueName } from '@oppenheimer/shared';

export class FindPullRequestsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly queue: PullRequestQueueName;

  constructor(props: { scope: AccessScope; queue: PullRequestQueueName }) {
    super();
    this.scope = props.scope;
    this.queue = props.queue;
  }
}
