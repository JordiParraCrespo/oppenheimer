import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { ListAutomationRunsQueryDto } from '@oppenheimer/shared';

export class FindAutomationRunsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly filters: ListAutomationRunsQueryDto;

  constructor(props: { scope: AccessScope; filters: ListAutomationRunsQueryDto }) {
    super();
    this.scope = props.scope;
    this.filters = props.filters;
  }
}
