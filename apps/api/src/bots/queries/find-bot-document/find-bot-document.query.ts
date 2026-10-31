import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindBotDocumentQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly name: string;

  constructor(props: { scope: AccessScope; botId: string; name: string }) {
    super();
    this.scope = props.scope;
    this.botId = props.botId;
    this.name = props.name;
  }
}
