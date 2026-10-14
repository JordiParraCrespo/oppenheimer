import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindBotMemoryFactQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly factId: string;

  constructor(props: { scope: AccessScope; botId: string; factId: string }) {
    super();
    this.scope = props.scope;
    this.botId = props.botId;
    this.factId = props.factId;
  }
}
