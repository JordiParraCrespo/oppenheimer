import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindAutomationRunQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly runId: string;

  constructor(props: { scope: AccessScope; runId: string }) {
    super();
    this.scope = props.scope;
    this.runId = props.runId;
  }
}
