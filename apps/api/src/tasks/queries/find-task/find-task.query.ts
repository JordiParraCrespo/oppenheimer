import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindTaskQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly taskId: string;

  constructor(props: { scope: AccessScope; taskId: string }) {
    super();
    this.scope = props.scope;
    this.taskId = props.taskId;
  }
}
