import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindCloudAgentRepositoriesQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly provider: string;

  constructor(props: { scope: AccessScope; provider: string }) {
    super();
    this.scope = props.scope;
    this.provider = props.provider;
  }
}
