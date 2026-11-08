import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { CloudReplyWakeResolver } from '../../application/cloud-reply-wake.resolver';
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
 *
 * When the hook has already stopped waiting, the session is idle and the
 * reply is sent from the host that started it, which wakes it
 * (`CloudReplyWakeResolver`). That takes a round trip to claude.ai, so it is
 * not awaited: the composer has its answer at once, and a reply the host
 * could not send goes back to waiting.
 */
@CommandHandler(SendCloudReplyCommand)
export class SendCloudReplyCommandHandler
  implements ICommandHandler<SendCloudReplyCommand, string>
{
  private readonly logger = new Logger(SendCloudReplyCommandHandler.name);

  constructor(
    private readonly loader: SessionLoaderResolver,
    private readonly waker: CloudReplyWakeResolver,
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
    this.waker.wake(session, reply).catch((error: unknown) => {
      this.logger.error(
        { message: 'waking a cloud session failed', sessionId: session.id },
        error instanceof Error ? error.stack : String(error),
      );
    });
    return reply.id;
  }
}
