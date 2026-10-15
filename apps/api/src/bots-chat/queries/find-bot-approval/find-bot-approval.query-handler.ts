import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { requireFound } from '@oppenheimer/backend-core';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_APPROVAL_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotApprovalEntity } from '../../domain/bot-approval.entity';
import { FindBotApprovalQuery } from './find-bot-approval.query';

/** One approval of a bot in the caller's workspace: what a decision answers with. */
@QueryHandler(FindBotApprovalQuery)
export class FindBotApprovalQueryHandler
  implements IQueryHandler<FindBotApprovalQuery, BotApprovalEntity>
{
  constructor(
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
  ) {}

  async execute({ scope, botId, approvalId }: FindBotApprovalQuery): Promise<BotApprovalEntity> {
    return requireFound(
      await this.approvals.findOne(scope, botId, approvalId),
      BotErrors.APPROVAL_NOT_FOUND,
    );
  }
}
