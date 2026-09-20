import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * One installation the caller can reach.
 *
 * It has no controller of its own: the endpoint surface has no
 * `GET /installations/{id}`, because the console lists installations and never
 * navigates to one. What dispatches it is `POST /installations`, which owes the
 * caller the full DTO after a write and gets it through the same scoped read the
 * listing uses.
 */
export class FindInstallationQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly installationId: string;

  constructor(props: { scope: AccessScope; installationId: string }) {
    super();
    this.scope = props.scope;
    this.installationId = props.installationId;
  }
}
