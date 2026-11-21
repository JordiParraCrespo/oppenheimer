import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/** Which bots are working and which wait on you. */
export interface BotActivity {
  working: string[];
  waitingOnYou: string[];
}

export class FindBotActivityQuery extends QueryBase {
  constructor(readonly scope: AccessScope) {
    super();
  }
}
