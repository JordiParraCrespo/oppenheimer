import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindGoalQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly goalId: string;

  constructor(props: { scope: AccessScope; goalId: string }) {
    super();
    this.scope = props.scope;
    this.goalId = props.goalId;
  }
}
