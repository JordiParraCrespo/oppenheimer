import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { RunHistoryQueryDto } from '@oppenheimer/shared';

export class FindRunHistoryQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly filters: RunHistoryQueryDto;

  constructor(props: { scope: AccessScope; filters: RunHistoryQueryDto }) {
    super();
    this.scope = props.scope;
    this.filters = props.filters;
  }
}
