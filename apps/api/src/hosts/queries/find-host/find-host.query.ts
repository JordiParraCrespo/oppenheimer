import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindHostQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly hostId: string;

  constructor(props: { scope: AccessScope; hostId: string }) {
    super();
    this.scope = props.scope;
    this.hostId = props.hostId;
  }
}
