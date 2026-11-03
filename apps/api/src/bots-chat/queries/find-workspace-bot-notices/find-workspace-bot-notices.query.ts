import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { BotNoticeEntity } from '../../domain/bot-notice.entity';

/** One bot's latest notice, with the name of the bot that sent it. */
export interface WorkspaceBotNotice {
  notice: BotNoticeEntity;
  botName: string;
}

export class FindWorkspaceBotNoticesQuery extends QueryBase {
  constructor(readonly scope: AccessScope) {
    super();
  }
}
