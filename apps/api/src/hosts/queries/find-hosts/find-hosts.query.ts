import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * Asks for the hosts a caller can reach.
 *
 * The scope travels on the query rather than being resolved inside the handler:
 * it is request state the controller already holds, and a handler reaching for it
 * itself would be reaching outside the bus for context.
 */
export class FindHostsQuery extends QueryBase {
  readonly scope: AccessScope;

  constructor(props: { scope: AccessScope }) {
    super();
    this.scope = props.scope;
  }
}
