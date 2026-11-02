import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * Where each project stands (`summarizePlan` in `@oppenheimer/shared/plan`), for a
 * reader outside the console: the agents' tools ask it on the query bus. The
 * console computes the same summary over the lists it already holds; there is no
 * HTTP route (`product/versions/mvp/23-plan-milestones-stats-accounts.md` §3).
 */
export class FindPlanSummaryQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly projectId?: string;
  /** The viewer's calendar day, `YYYY-MM-DD`: what is overdue depends on where they are. */
  readonly today: string;

  constructor(props: { scope: AccessScope; projectId?: string; today: string }) {
    super();
    this.scope = props.scope;
    this.projectId = props.projectId;
    this.today = props.today;
  }
}
