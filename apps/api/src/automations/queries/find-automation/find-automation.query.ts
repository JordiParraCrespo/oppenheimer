import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindAutomationQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly automationId: string;

  constructor(props: { scope: AccessScope; automationId: string }) {
    super();
    this.scope = props.scope;
    this.automationId = props.automationId;
  }
}
