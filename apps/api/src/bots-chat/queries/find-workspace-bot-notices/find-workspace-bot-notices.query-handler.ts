import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WORKSPACE_BOT_NOTICES_MAX } from '@oppenheimer/shared';
import { BOT_NOTICE_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotNoticeRepositoryPort } from '../../database/bot-notice.repository.port';
import {
  FindWorkspaceBotNoticesQuery,
  type WorkspaceBotNotice,
} from './find-workspace-bot-notices.query';

/**
 * The workspace's bots' latest notices, newest first, at most
 * {@link WORKSPACE_BOT_NOTICES_MAX}: the Inbox's lines from bots
 * (`product/next-steps/agent-tools.md` §5), read through the caller's
 * scope with each bot's name.
 */
@QueryHandler(FindWorkspaceBotNoticesQuery)
export class FindWorkspaceBotNoticesQueryHandler
  implements IQueryHandler<FindWorkspaceBotNoticesQuery, WorkspaceBotNotice[]>
{
  constructor(
    @Inject(BOT_NOTICE_REPOSITORY) private readonly notices: BotNoticeRepositoryPort,
  ) {}

  execute({ scope }: FindWorkspaceBotNoticesQuery): Promise<WorkspaceBotNotice[]> {
    return this.notices.findInWorkspace(scope, WORKSPACE_BOT_NOTICES_MAX);
  }
}
