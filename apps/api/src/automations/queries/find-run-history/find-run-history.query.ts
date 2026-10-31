import { QueryBase } from '@oppenheimer/backend-ddd';
import type { RunHistoryQueryDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class FindRunHistoryQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly filters: RunHistoryQueryDto;

  constructor(props: { scope: AccessScope; filters: RunHistoryQueryDto }) {
    super();
    this.scope = props.scope;
    this.filters = props.filters;
  }
}
