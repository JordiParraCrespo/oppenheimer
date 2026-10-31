import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindHostsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly includeUnpaired: boolean;

  constructor(props: { scope: AccessScope; includeUnpaired?: boolean }) {
    super();
    this.scope = props.scope;
    this.includeUnpaired = props.includeUnpaired ?? false;
  }
}
