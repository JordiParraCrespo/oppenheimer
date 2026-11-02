import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { PlanStatsQueryDto } from '@oppenheimer/shared';

/** Plan's Stats for a period, per week in the viewer's zone (`GET /plan/stats`). */
export class FindPlanStatsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly period: PlanStatsQueryDto;

  constructor(props: { scope: AccessScope; period: PlanStatsQueryDto }) {
    super();
    this.scope = props.scope;
    this.period = props.period;
  }
}
