import type { BotApprovalStatus } from '@oppenheimer/shared';
import type { Option } from 'oxide.ts';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { BotApprovalEntity } from '../domain/bot-approval.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotToolPermissionEntity } from '../domain/bot-tool-permission.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/** What a decision owes, written in the same transaction as the move itself. */
export interface BotApprovalEffects {
  /** The bot's turn that reports back, opened by the decision's event. */
  continuation?: { turn: BotTurnEntity; opening: BotMessageEntity };
  /** A yes: the `run-approved-call` job, with who decided, by name, for the event. */
  runCall?: { by: string };
  /**
   * A yes that reaches past this call: the tool's Allow or a standing grant
   * (`BotApprovalEntity.standing`), written with the decision. A grant past
   * `maxGrants` is `BOTS_034`, and the decision is not written either.
   */
  standing?: { permission: BotToolPermissionEntity; maxGrants: number };
}

export interface BotApprovalRepositoryPort {
  /**
   * Stores a new pending approval, unless the bot already has a card
   * waiting, an approval or questions: then nothing is written, and the
   * answer is that card's line.
   */
  insertPending(approval: BotApprovalEntity): Promise<'inserted' | { waiting: string }>;

  /** One approval of a bot in the caller's workspace. */
  findOne(
    scope: AccessScope,
    botId: string,
    approvalId: string,
  ): Promise<Option<BotApprovalEntity>>;
  /** The worker's read: by id alone, the job carries nothing else it can trust. */
  findForRun(approvalId: string): Promise<Option<BotApprovalEntity>>;
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
   * The caller's workspace's approvals in one status, across its bots, newest
   * first, at most `limit` (the Inbox's pending approvals).
   */
  findInWorkspace(
    scope: AccessScope,
    status: BotApprovalStatus,
    limit: number,
  ): Promise<BotApprovalEntity[]>;

  /**
   * Stores a move, conditioned on the status the approval was loaded in (and,
   * for a result, on there being none yet), with what it owes in the same
   * transaction: the turn that reports back, or the job that runs the call.
   * Whether this write won: `false` means another got there first, and
   * nothing it owed was written.
   */
  saveTransition(
    approval: BotApprovalEntity,
    effects?: BotApprovalEffects,
    correlationId?: string | null,
  ): Promise<boolean>;
}
