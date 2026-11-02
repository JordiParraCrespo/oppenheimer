import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** Every bot's routines in the workspace, for `/automations` (`26-bot-routines.md` §7). */
export class FindRoutinesQuery extends QueryBase {
  readonly scope: AccessScope;

  constructor(props: { scope: AccessScope }) {
    super();
    this.scope = props.scope;
  }
}
