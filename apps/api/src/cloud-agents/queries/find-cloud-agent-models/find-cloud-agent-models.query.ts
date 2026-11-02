import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindCloudAgentModelsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly provider: string;

  constructor(props: { scope: AccessScope; provider: string }) {
    super();
    this.scope = props.scope;
    this.provider = props.provider;
  }
}
