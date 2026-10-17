import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BOT_APPROVALS_PAGE_MAX } from '@oppenheimer/shared';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BOT_APPROVAL_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotApprovalRepositoryPort } from '../../database/bot-approval.repository.port';
import type { BotApprovalEntity } from '../../domain/bot-approval.entity';
import { FindBotApprovalsQuery } from './find-bot-approvals.query';

/**
 * A bot's Needs input cards, newest first (`25-bots.md` §5): `pending` is the
 * one the chat shows, at most one; the rest are what was decided. A bot in
 * another workspace is one that does not exist (`BOTS_001`).
 */
@QueryHandler(FindBotApprovalsQuery)
export class FindBotApprovalsQueryHandler
  implements IQueryHandler<FindBotApprovalsQuery, BotApprovalEntity[]>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_APPROVAL_REPOSITORY) private readonly approvals: BotApprovalRepositoryPort,
  ) {}

  async execute({ scope, botId, status }: FindBotApprovalsQuery): Promise<BotApprovalEntity[]> {
    const bot = await this.lookup.bot(scope, botId);
    return this.approvals.findForBot(scope, bot.id, status, BOT_APPROVALS_PAGE_MAX);
  }
}
