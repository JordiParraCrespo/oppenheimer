import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindAutomationQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly automationId: string;

  constructor(props: { scope: AccessScope; automationId: string }) {
    super();
    this.scope = props.scope;
    this.automationId = props.automationId;
  }
}
