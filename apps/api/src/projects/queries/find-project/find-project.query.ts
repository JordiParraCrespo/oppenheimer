import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindProjectQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly projectId: string;

  constructor(props: { scope: AccessScope; projectId: string }) {
    super();
    this.scope = props.scope;
    this.projectId = props.projectId;
  }
}
