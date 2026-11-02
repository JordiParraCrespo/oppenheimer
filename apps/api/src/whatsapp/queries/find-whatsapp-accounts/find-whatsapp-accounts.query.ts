import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { WhatsappAccountEntity } from '../../domain/whatsapp-account.entity';

/** A number, and whether its host's runner can be reached now. */
export interface WhatsappAccountView {
  account: WhatsappAccountEntity;
  hostOnline: boolean;
}

export class FindWhatsappAccountsQuery extends QueryBase {
  readonly scope: AccessScope;
  /** Only this one of the caller's, when given. */
  readonly id?: string;

  constructor(props: { scope: AccessScope; id?: string }) {
    super();
    this.scope = props.scope;
    this.id = props.id;
  }
}
