import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { SessionCloudChatRepositoryPort } from '../../database/session-cloud-chat.repository.port';
import { hasCloudChat } from '../../domain/cloud-chat.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_CLOUD_CHAT_REPOSITORY } from '../../sessions.di-tokens';
import { SendCloudReplyCommand } from './send-cloud-reply.command';

/**
 * A reply typed in a Claude Code cloud session's chat, kept until the Stop
 * hook in that session collects it when the agent ends its turn. The session
 * is read in the caller's scope first, which is the authorization. Answers
 * the reply's id.
 */
@CommandHandler(SendCloudReplyCommand)
export class SendCloudReplyCommandHandler
  implements ICommandHandler<SendCloudReplyCommand, string>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
  ) {}

  async execute(command: SendCloudReplyCommand): Promise<string> {
    const session = await this.loader.requireLive(command.scope, command.sessionId);
    if (!hasCloudChat(session)) {
      throw new AppError(SessionErrors.NO_CLOUD_CHAT, {
        detail: `Session ${session.slug} is not a Claude Code cloud session`,
      });
    }
    const reply = await this.chat.addReply(
      session.organizationId,
      session.id,
      command.authorId,
      command.text,
    );
    return reply.id;
  }
}
