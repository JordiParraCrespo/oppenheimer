import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WORKSPACE_BOT_APPROVALS_MAX } from '@oppenheimer/shared';
import { BOT_REPOSITORY } from '../../../bots/bots.di-tokens';
import type { BotRepositoryPort } from '../../../bots/database/bot.repository.port';
import { BOT_APPROVAL_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import {
  FindWorkspaceBotApprovalsQuery,
  type WorkspaceBotApproval,
} from './find-workspace-bot-approvals.query';

/**
 * The workspace's approvals in one status across its bots, newest first, at
 * most {@link WORKSPACE_BOT_APPROVALS_MAX}: the Inbox's pending approvals
 * (`product/versions/mvp/29-inbox.md` §4). Both reads go through the caller's
 * scope, and an approval whose bot that scope cannot see is left out, so the
 * list is what the per-bot read (`GET /bots/:id/approvals`) would answer for
 * each bot the caller may read.
 */
@QueryHandler(FindWorkspaceBotApprovalsQuery)
export class FindWorkspaceBotApprovalsQueryHandler
  implements IQueryHandler<FindWorkspaceBotApprovalsQuery, WorkspaceBotApproval[]>
{
  constructor(
    @Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort,
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
  ) {}

  async execute({
    scope,
    status,
  }: FindWorkspaceBotApprovalsQuery): Promise<WorkspaceBotApproval[]> {
    const [approvals, bots] = await Promise.all([
      this.approvals.findInWorkspace(scope, status, WORKSPACE_BOT_APPROVALS_MAX),
      this.bots.findAll(scope),
    ]);
    const names = new Map(bots.map((bot) => [bot.id, bot.name]));
    return approvals.flatMap((approval) => {
      const botName = names.get(approval.botId);
      return botName === undefined ? [] : [{ approval, botName }];
    });
  }
}
