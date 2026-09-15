import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindLeadByIdQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly leadId: string;

  constructor(props: { scope: AccessScope; leadId: string }) {
    super();
    this.scope = props.scope;
    this.leadId = props.leadId;
  }
}
