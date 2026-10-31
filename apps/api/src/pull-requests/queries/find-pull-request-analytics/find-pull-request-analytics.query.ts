import { QueryBase } from '@oppenheimer/backend-ddd';
import type { PullRequestAnalyticsRange } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindPullRequestAnalyticsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly range: PullRequestAnalyticsRange;

  constructor(props: { scope: AccessScope; range: PullRequestAnalyticsRange }) {
    super();
    this.scope = props.scope;
    this.range = props.range;
  }
}
