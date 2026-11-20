import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** Every chat one of the caller's numbers has seen or allows, with who answers it. */
export class FindWhatsappChatRoutesQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly accountId: string;

  constructor(props: { scope: AccessScope; accountId: string }) {
    super();
    this.scope = props.scope;
    this.accountId = props.accountId;
  }
}
