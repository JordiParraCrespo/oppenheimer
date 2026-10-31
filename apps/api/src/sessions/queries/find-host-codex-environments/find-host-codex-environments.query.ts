import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** A host's Codex cloud environments, listed by its runner, those linked to `repository` marked. */
export class FindHostCodexEnvironmentsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly hostId: string;
  /** `owner/name`. */
  readonly repository: string;

  constructor(props: { scope: AccessScope; hostId: string; repository: string }) {
    super();
    this.scope = props.scope;
    this.hostId = props.hostId;
    this.repository = props.repository;
  }
}
