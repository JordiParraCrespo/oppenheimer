import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindBotConversationQuery extends QueryBase {
  constructor(
    readonly scope: AccessScope,
    readonly botId: string,
    readonly limit: number,
  ) {
    super();
  }
}
