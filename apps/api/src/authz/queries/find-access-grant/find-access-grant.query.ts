import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../domain/access-scope.types';

export class FindAccessGrantQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly grantId: string;

  constructor(props: { scope: AccessScope; grantId: string }) {
    super();
    this.scope = props.scope;
    this.grantId = props.grantId;
  }
}
