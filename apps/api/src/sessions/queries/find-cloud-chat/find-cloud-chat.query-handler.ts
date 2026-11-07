import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionCloudChatRepositoryPort } from '../../database/session-cloud-chat.repository.port';
import { hasCloudChat } from '../../domain/cloud-chat.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import type { CloudChatResponseDto } from '../../dtos/session-cloud-chat.response.dto';
import { SessionCloudChatMapper } from '../../session-cloud-chat.mapper';
import { SESSION_CLOUD_CHAT_REPOSITORY } from '../../sessions.di-tokens';
import { FindCloudChatQuery } from './find-cloud-chat.query';

/** Replies a chat lists: far more than a person types in one session. */
const MAX_REPLIES = 500;

/**
 * A Claude Code cloud session's chat as its hooks keep it: the transcript
 * lines from `after` on, and every reply typed here with whether its Stop
 * hook has collected it. The session is read in the caller's scope first,
 * which is the authorization.
 */
@QueryHandler(FindCloudChatQuery)
export class FindCloudChatQueryHandler
  implements IQueryHandler<FindCloudChatQuery, CloudChatResponseDto>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
  ) {}

  async execute(query: FindCloudChatQuery): Promise<CloudChatResponseDto> {
    const session = await this.loader.find(query.scope, query.sessionId);
    if (!hasCloudChat(session)) {
      throw new AppError(SessionErrors.NO_CLOUD_CHAT, {
        detail: `Session ${session.slug} is not a Claude Code cloud session`,
      });
    }
    const [lines, replies] = await Promise.all([
      this.chat.findLines(session.id, query.after, query.limit),
      this.chat.findReplies(session.organizationId, session.id, MAX_REPLIES),
    ]);
    return SessionCloudChatMapper.toChat(query.after, lines, replies);
  }
}
