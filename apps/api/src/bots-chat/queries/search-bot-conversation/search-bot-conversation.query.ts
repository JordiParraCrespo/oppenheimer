import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class SearchBotConversationQuery extends QueryBase {
  constructor(
    readonly scope: AccessScope,
    readonly botId: string,
    readonly query: string,
    readonly limit: number,
  ) {
    super();
  }
}
