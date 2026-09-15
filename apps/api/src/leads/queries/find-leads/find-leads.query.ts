import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * Asks for the leads a caller can reach.
 *
 * The scope travels on the query rather than being resolved inside the handler:
 * it is request state, and a handler that reached for it itself would be
 * reaching outside the bus for context the controller already has.
 */
export class FindLeadsQuery extends QueryBase {
  readonly scope: AccessScope;

  constructor(props: { scope: AccessScope }) {
    super();
    this.scope = props.scope;
  }
}
