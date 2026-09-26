import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** One access grant by id, inside the caller's active organization. */
export class FindAccessGrantQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly grantId: string;

  constructor(props: { scope: AccessScope; grantId: string }) {
    super();
    this.scope = props.scope;
    this.grantId = props.grantId;
  }
}
