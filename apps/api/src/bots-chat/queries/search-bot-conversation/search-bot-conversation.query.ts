import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class SearchBotConversationQuery extends QueryBase {
  constructor(
    readonly scope: AccessScope,
    /** The conversation searched: the bot's id for its console chat. */
    readonly conversationId: string,
    readonly query: string,
    readonly limit: number,
  ) {
    super();
  }
}
