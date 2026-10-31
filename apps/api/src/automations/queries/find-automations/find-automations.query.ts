import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindAutomationsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly projectId?: string;

  constructor(props: { scope: AccessScope; projectId?: string }) {
    super();
    this.scope = props.scope;
    this.projectId = props.projectId;
  }
}
