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
  /** Retired projects are left out unless the caller is looking at the history. */
  readonly includeArchived: boolean;

  constructor(props: { scope: AccessScope; includeArchived?: boolean }) {
    super();
    this.scope = props.scope;
    this.includeArchived = props.includeArchived ?? false;
  }
}
