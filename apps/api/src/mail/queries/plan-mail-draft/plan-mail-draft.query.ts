import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** A saved draft as it stands, as a plan to send it unchanged. */
export class PlanMailDraftQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly draftId: string;

  constructor(props: { scope: AccessScope; connectionId: string; draftId: string }) {
    super();
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.draftId = props.draftId;
  }
}
