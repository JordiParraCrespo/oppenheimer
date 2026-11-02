import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindGoogleCalendarConnectionQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly id: string;

  constructor(props: { scope: AccessScope; id: string }) {
    super();
    this.scope = props.scope;
    this.id = props.id;
  }
}
