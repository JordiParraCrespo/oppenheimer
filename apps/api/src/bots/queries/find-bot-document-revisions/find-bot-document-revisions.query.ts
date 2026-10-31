import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindBotDocumentRevisionsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly name: string;
  readonly limit: number;

  constructor(props: { scope: AccessScope; botId: string; name: string; limit: number }) {
    super();
    this.scope = props.scope;
    this.botId = props.botId;
    this.name = props.name;
    this.limit = props.limit;
  }
}
