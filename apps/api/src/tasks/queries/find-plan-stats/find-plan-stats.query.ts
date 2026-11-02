import { QueryBase } from '@oppenheimer/backend-ddd';
import type { PlanStatsQueryDto } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

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
