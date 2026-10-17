import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindMilestoneQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly milestoneId: string;

  constructor(props: { scope: AccessScope; milestoneId: string }) {
    super();
    this.scope = props.scope;
    this.milestoneId = props.milestoneId;
  }
}
