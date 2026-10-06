import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { PullRequestAnalyticsRange } from '@oppenheimer/shared';

export class FindPullRequestAnalyticsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly range: PullRequestAnalyticsRange;

  constructor(props: { scope: AccessScope; range: PullRequestAnalyticsRange }) {
    super();
    this.scope = props.scope;
    this.range = props.range;
  }
}
