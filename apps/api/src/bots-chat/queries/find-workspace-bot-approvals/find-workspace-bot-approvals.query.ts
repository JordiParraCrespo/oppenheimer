import { QueryBase } from '@oppenheimer/backend-ddd';
import type { BotApprovalStatus } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';
import type { BotApprovalEntity } from '../../domain/bot-approval.entity';

/** One approval of the workspace's, with the name of the bot that asked. */
export interface WorkspaceBotApproval {
  approval: BotApprovalEntity;
  botName: string;
}

export class FindWorkspaceBotApprovalsQuery extends QueryBase {
  constructor(
    readonly scope: AccessScope,
    readonly status: BotApprovalStatus,
  ) {
    super();
  }
}
