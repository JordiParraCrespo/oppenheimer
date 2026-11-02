import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindMilestoneQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly milestoneId: string;

  constructor(props: { scope: AccessScope; milestoneId: string }) {
    super();
    this.scope = props.scope;
    this.milestoneId = props.milestoneId;
  }
}
