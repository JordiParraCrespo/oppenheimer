import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionCloudChatRepositoryPort } from '../../database/session-cloud-chat.repository.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { hasCloudChat } from '../../domain/cloud-chat.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_CLOUD_CHAT_REPOSITORY, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { AppendCloudTranscriptCommand } from './append-cloud-transcript.command';

/**
 * Stores lines of a Claude Code cloud session's transcript, sent by the
 * SessionStart hook in that session. The session is found by its cloud id in
 * the caller's scope, so a credential reaches only its own workspace's
 * sessions, and only one this workspace launched keeps a chat here. Lines are
 * numbered by the hook, so a batch sent again stores nothing twice.
 */
@CommandHandler(AppendCloudTranscriptCommand)
export class AppendCloudTranscriptCommandHandler
  implements ICommandHandler<AppendCloudTranscriptCommand, number>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
  ) {}

  async execute(command: AppendCloudTranscriptCommand): Promise<number> {
    const [session] = await this.sessions.findCloudByCloudIds(command.scope, [
      command.cloudSessionId,
    ]);
    if (!session || !hasCloudChat(session)) {
      throw new AppError(SessionErrors.CLOUD_CHAT_SESSION_NOT_FOUND, {
        detail: `No Claude Code cloud session ${command.cloudSessionId} in this workspace`,
      });
    }
    return this.chat.appendLines(session.organizationId, session.id, command.from, command.lines);
  }
}
