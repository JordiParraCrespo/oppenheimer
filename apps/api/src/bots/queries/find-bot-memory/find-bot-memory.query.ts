import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindBotMemoryQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly botId: string;

  constructor(props: { scope: AccessScope; botId: string }) {
    super();
    this.scope = props.scope;
    this.botId = props.botId;
  }
}
