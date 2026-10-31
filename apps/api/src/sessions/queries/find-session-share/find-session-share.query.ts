import { QueryBase } from '@oppenheimer/backend-ddd';
import type { CredentialOwner } from '../../../auth/domain/scope-context.types';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { SessionShareEntity } from '../../domain/session-share.entity';

/** What the query answers: the share, and who it acts as while their account is active. */
export interface FoundSessionShare {
  share: SessionShareEntity;
  owner: CredentialOwner | null;
}

export class FindSessionShareQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly sessionId: string;

  constructor(props: { scope: AccessScope; sessionId: string }) {
    super();
    this.scope = props.scope;
    this.sessionId = props.sessionId;
  }
}
