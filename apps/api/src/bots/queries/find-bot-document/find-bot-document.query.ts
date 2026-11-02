import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

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
