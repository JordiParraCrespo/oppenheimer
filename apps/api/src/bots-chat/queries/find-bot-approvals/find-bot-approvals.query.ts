import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';
import type { BotApprovalStatus } from '@oppenheimer/shared';

export class FindBotApprovalsQuery extends QueryBase {
  constructor(
    readonly scope: AccessScope,
    readonly botId: string,
    readonly status: BotApprovalStatus | undefined,
  ) {
    super();
  }
}
