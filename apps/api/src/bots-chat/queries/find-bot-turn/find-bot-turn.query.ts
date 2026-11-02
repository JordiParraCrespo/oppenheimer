import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

export class FindBotTurnQuery extends QueryBase {
  constructor(
    readonly scope: AccessScope,
    readonly botId: string,
    readonly turnId: string,
    /**
     * The message the turn was opened with. A steer's turn is gone once the
     * running turn takes it; the lookup then answers the turn holding it.
     */
    readonly openingMessageId: string | null = null,
  ) {
    super();
  }
}
