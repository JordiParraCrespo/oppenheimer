import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** One thread of one of the caller's Gmail accounts, every message as text. */
export class ReadMailThreadQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly connectionId: string;
  readonly threadId: string;

  constructor(props: { scope: AccessScope; connectionId: string; threadId: string }) {
    super();
    this.scope = props.scope;
    this.connectionId = props.connectionId;
    this.threadId = props.threadId;
  }
}
