import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * Asks for the projects a caller can reach.
 *
 * The scope travels on the query rather than being resolved in the handler: it is
 * request state the controller already has.
 */
export class FindProjectsQuery extends QueryBase {
  readonly scope: AccessScope;

  constructor(props: { scope: AccessScope }) {
    super();
    this.scope = props.scope;
  }
}
