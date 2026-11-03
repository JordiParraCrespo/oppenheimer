import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WORKSPACE_BOT_NOTICES_MAX } from '@oppenheimer/shared';
import { BOT_REPOSITORY } from '../../../bots/bots.di-tokens';
import type { BotRepositoryPort } from '../../../bots/database/bot.repository.port';
import { BOT_NOTICE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotNoticeRepositoryPort } from '../../database/bot-notice.repository.port';
import {
  FindWorkspaceBotNoticesQuery,
  type WorkspaceBotNotice,
} from './find-workspace-bot-notices.query';

/**
 * The workspace's bots' latest notices, newest first, at most
 * {@link WORKSPACE_BOT_NOTICES_MAX}: the Inbox's lines from bots
 * (`product/next-steps/agent-tools.md` §5). Both reads go through the
 * caller's scope, and a notice whose bot that scope cannot see is left out.
 */
@QueryHandler(FindWorkspaceBotNoticesQuery)
export class FindWorkspaceBotNoticesQueryHandler
  implements IQueryHandler<FindWorkspaceBotNoticesQuery, WorkspaceBotNotice[]>
{
  constructor(
    @Inject(BOT_REPOSITORY) private readonly bots: BotRepositoryPort,
    @Inject(BOT_NOTICE_REPOSITORY) private readonly notices: BotNoticeRepositoryPort,
  ) {}

  async execute({ scope }: FindWorkspaceBotNoticesQuery): Promise<WorkspaceBotNotice[]> {
    const [notices, bots] = await Promise.all([
      this.notices.findInWorkspace(scope, WORKSPACE_BOT_NOTICES_MAX),
      this.bots.findAll(scope),
    ]);
    const names = new Map(bots.map((bot) => [bot.id, bot.name]));
    return notices.flatMap((notice) => {
      const botName = names.get(notice.botId);
      return botName === undefined ? [] : [{ notice, botName }];
    });
  }
}
