import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { NamedBotNotice } from '../../database/bot-notice.repository.port';

/** One bot's latest notice, with the name of the bot that sent it. */
export type WorkspaceBotNotice = NamedBotNotice;

export class FindWorkspaceBotNoticesQuery extends QueryBase {
  constructor(readonly scope: AccessScope) {
    super();
  }
}
