import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** What the caller's bots sent from their Gmail, newest first. */
export class FindSentMailQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly limit: number;

  constructor(props: { scope: AccessScope; limit: number }) {
    super();
    this.scope = props.scope;
    this.limit = props.limit;
  }
}
