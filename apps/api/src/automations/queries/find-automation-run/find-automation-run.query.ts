import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindAutomationRunQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly runId: string;

  constructor(props: { scope: AccessScope; runId: string }) {
    super();
    this.scope = props.scope;
    this.runId = props.runId;
  }
}
