import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindBotGroupQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly groupId: string;

  constructor(props: { scope: AccessScope; groupId: string }) {
    super();
    this.scope = props.scope;
    this.groupId = props.groupId;
  }
}
