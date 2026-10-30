import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { MailRequest } from '../../domain/mail-send.policy';

/** What a requested message would be, every default resolved; nothing is written. */
export class PlanMailQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly request: MailRequest;

  constructor(props: { scope: AccessScope; connectionId: string; request: MailRequest }) {
    super();
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.request = props.request;
  }
}
