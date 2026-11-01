import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindWhatsappChatsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  readonly limit: number;

  constructor(props: { scope: AccessScope; accountId: string; limit: number }) {
    super();
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.limit = props.limit;
  }
}
