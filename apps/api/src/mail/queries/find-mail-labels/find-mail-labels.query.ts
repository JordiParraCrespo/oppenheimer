import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** The labels of one of the caller's Gmail accounts, with their unread counts. */
export class FindMailLabelsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly connectionId: string;

  constructor(props: { scope: AccessScope; connectionId: string }) {
    super();
    this.scope = props.scope;
    this.connectionId = props.connectionId;
  }
}
