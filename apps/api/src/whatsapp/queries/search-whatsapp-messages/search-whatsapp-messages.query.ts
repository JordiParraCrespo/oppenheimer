import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class SearchWhatsappMessagesQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  readonly query: string;
  readonly limit: number;

  constructor(props: { scope: AccessScope; accountId: string; query: string; limit: number }) {
    super();
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.query = props.query;
    this.limit = props.limit;
  }
}
