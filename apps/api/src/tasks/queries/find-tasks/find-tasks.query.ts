import { QueryBase } from '@oppenheimer/backend-ddd';
import type { ListTasksQueryDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindTasksQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly filter: ListTasksQueryDto;

  constructor(props: { scope: AccessScope; filter: ListTasksQueryDto }) {
    super();
    this.scope = props.scope;
    this.filter = props.filter;
  }
}
