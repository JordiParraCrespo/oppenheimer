import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionCloudChatRepositoryPort } from '../../database/session-cloud-chat.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_CLOUD_CHAT_REPOSITORY } from '../../sessions.di-tokens';
import { ReleaseCloudReplyCommand } from './release-cloud-reply.command';

/**
 * Hands back a reply the browser extension claimed and claude.ai refused, so
 * it waits again: the session's Stop hook takes it at the end of the next
 * turn. Only the extension's own claim on the caller's own reply is released;
 * anything else answers `false` and changes nothing.
 */
@CommandHandler(ReleaseCloudReplyCommand)
export class ReleaseCloudReplyCommandHandler
  implements ICommandHandler<ReleaseCloudReplyCommand, boolean>
{
  private readonly logger = new Logger(ReleaseCloudReplyCommandHandler.name);

  constructor(
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
  ) {}

  async execute(command: ReleaseCloudReplyCommand): Promise<boolean> {
    const organizationId = command.scope.organizationId;
    if (!organizationId) throw new AppError(SessionErrors.NO_ACTIVE_ORGANIZATION);
    const released = await this.chat.releaseBrowserClaim(
      organizationId,
      command.userId,
      command.replyId,
    );
    if (released) {
      this.logger.warn({
        message: 'claude.ai refused a reply the browser extension posted; it waits again',
        replyId: command.replyId,
        reason: command.reason ?? null,
      });
    }
    return released;
  }
}
