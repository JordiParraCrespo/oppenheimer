import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionCloudChatRepositoryPort } from '../../database/session-cloud-chat.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_CLOUD_CHAT_REPOSITORY } from '../../sessions.di-tokens';
import { ConfirmCloudReplyCommand } from './confirm-cloud-reply.command';

/**
 * The browser extension's word that claude.ai took a reply it claimed: the
 * claim stops lapsing, so neither the hook nor a host delivers the reply a
 * second time. Only the caller's own claim, still held, is confirmed; a lapsed
 * one another way took answers `false`.
 */
@CommandHandler(ConfirmCloudReplyCommand)
export class ConfirmCloudReplyCommandHandler
  implements ICommandHandler<ConfirmCloudReplyCommand, boolean>
{
  constructor(
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
  ) {}

  async execute(command: ConfirmCloudReplyCommand): Promise<boolean> {
    const organizationId = command.scope.organizationId;
    if (!organizationId) throw new AppError(SessionErrors.NO_ACTIVE_ORGANIZATION);
    return this.chat.confirmBrowserDelivery(organizationId, command.userId, command.replyId);
  }
}
