import { QueryBase } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** A bot's routines, with what their runs say (`26-bot-routines.md` §4, §7). */
export class FindBotRoutinesQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly botId: string;

  constructor(props: { scope: AccessScope; botId: string }) {
    super();
    this.scope = props.scope;
    this.botId = props.botId;
  }
}
