import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** Every bot's routines in the workspace, for `/automations` (`26-bot-routines.md` §7). */
export class FindRoutinesQuery extends QueryBase {
  readonly scope: AccessScope;

  constructor(props: { scope: AccessScope }) {
    super();
    this.scope = props.scope;
  }
}
