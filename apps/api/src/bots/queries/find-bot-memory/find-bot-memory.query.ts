import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindBotMemoryQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly botId: string;

  constructor(props: { scope: AccessScope; botId: string }) {
    super();
    this.scope = props.scope;
    this.botId = props.botId;
  }
}
