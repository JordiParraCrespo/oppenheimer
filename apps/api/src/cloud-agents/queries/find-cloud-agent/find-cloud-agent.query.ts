import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindCloudAgentQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly id: string;

  constructor(props: { scope: AccessScope; id: string }) {
    super();
    this.scope = props.scope;
    this.id = props.id;
  }
}
