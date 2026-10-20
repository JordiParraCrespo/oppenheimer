import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

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
