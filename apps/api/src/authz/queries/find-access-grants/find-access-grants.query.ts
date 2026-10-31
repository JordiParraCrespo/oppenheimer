import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../domain/access-scope.types';

export class FindAccessGrantsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly page: number;
  readonly limit: number;

  constructor(props: { scope: AccessScope; page: number; limit: number }) {
    super();
    this.scope = props.scope;
    this.page = props.page;
    this.limit = props.limit;
  }
}
