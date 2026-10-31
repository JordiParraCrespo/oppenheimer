import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindBotGroupQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly groupId: string;

  constructor(props: { scope: AccessScope; groupId: string }) {
    super();
    this.scope = props.scope;
    this.groupId = props.groupId;
  }
}
