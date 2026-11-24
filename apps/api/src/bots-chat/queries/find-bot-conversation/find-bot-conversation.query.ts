import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindBotConversationQuery extends QueryBase {
  constructor(
    readonly scope: AccessScope,
    readonly botId: string,
    readonly limit: number,
    /** The message the page ends just before; `null` for the newest. */
    readonly before: string | null = null,
  ) {
    super();
  }
}
