import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * The scope travels on the query rather than being resolved inside the handler:
 * it is request state the controller already holds, and a handler reaching for it
 * itself would be reaching outside the bus for context.
 */
export class FindHostsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly includeUnpaired: boolean;

  constructor(props: { scope: AccessScope; includeUnpaired?: boolean }) {
    super();
    this.scope = props.scope;
    this.includeUnpaired = props.includeUnpaired ?? false;
  }
}
