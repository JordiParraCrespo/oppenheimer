import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { TelegramAccountEntity } from '../../domain/telegram-account.entity';

/** A Telegram bot, and whether its host's runner can be reached now. */
export interface TelegramAccountView {
  account: TelegramAccountEntity;
  hostOnline: boolean;
}

export class FindTelegramAccountsQuery extends QueryBase {
  readonly scope: AccessScope;
  /** Only this one of the caller's, when given. */
  readonly id?: string;

  constructor(props: { scope: AccessScope; id?: string }) {
    super();
    this.scope = props.scope;
    this.id = props.id;
  }
}
