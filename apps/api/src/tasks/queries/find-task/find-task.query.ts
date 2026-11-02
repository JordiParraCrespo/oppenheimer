import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindTaskQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly taskId: string;

  constructor(props: { scope: AccessScope; taskId: string }) {
    super();
    this.scope = props.scope;
    this.taskId = props.taskId;
  }
}
