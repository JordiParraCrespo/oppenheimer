import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotApprovalStatus } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { BotApprovalEntity } from '../domain/bot-approval.entity';

export interface BotApprovalRepositoryPort {
  /**
   * Stores a new pending approval. `pending_exists` when the bot already has
   * one waiting (`UQ_bot_approval_pending`): nothing is written.
   */
  insertPending(approval: BotApprovalEntity): Promise<'inserted' | 'pending_exists'>;

  /** One approval of a bot in the caller's workspace. */
  findOne(
    scope: AccessScope,
    botId: string,
    approvalId: string,
  ): Promise<Option<BotApprovalEntity>>;
  /** The bot's waiting approval, read by its workspace (a turn's tools, a new message). */
  findPending(organizationId: string, botId: string): Promise<Option<BotApprovalEntity>>;
  /** A bot's approvals in the caller's workspace, newest first, at most `limit`. */
  findForBot(
    scope: AccessScope,
    botId: string,
    status: BotApprovalStatus | undefined,
    limit: number,
  ): Promise<BotApprovalEntity[]>;

  /**
   * Stores a move, conditioned on the status the approval was loaded in.
   * Whether this write won: `false` means another decision got there first.
   */
  saveTransition(approval: BotApprovalEntity): Promise<boolean>;
}
