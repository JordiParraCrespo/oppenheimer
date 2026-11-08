import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type {
  CloudChatReply,
  SessionCloudChatRepositoryPort,
} from '../../database/session-cloud-chat.repository.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { hasCloudChat } from '../../domain/cloud-chat.policy';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_CLOUD_CHAT_REPOSITORY, WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { CollectCloudReplyCommand } from './collect-cloud-reply.command';

/** How often a waiting hook's request looks for a reply. */
const POLL_MS = 1000;

/**
 * Hands the Stop hook in a Claude Code cloud session the oldest reply typed in
 * its chat, marking it collected, so the agent carries on with it. With none
 * waiting it looks again each second for up to the wait the hook asked for:
 * a reply typed just after the turn ended still reaches the agent. The claim
 * is the repository's, so two hooks asking at once never take one reply.
 */
@CommandHandler(CollectCloudReplyCommand)
export class CollectCloudReplyCommandHandler
  implements ICommandHandler<CollectCloudReplyCommand, CloudChatReply | null>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
  ) {}

  async execute(command: CollectCloudReplyCommand): Promise<CloudChatReply | null> {
    const [session] = await this.sessions.findCloudByCloudIds(command.scope, [
      command.cloudSessionId,
    ]);
    if (!session || !hasCloudChat(session)) {
      throw new AppError(SessionErrors.CLOUD_CHAT_SESSION_NOT_FOUND, {
        detail: `No Claude Code cloud session ${command.cloudSessionId} in this workspace`,
      });
    }
    const until = Date.now() + command.waitSeconds * 1000;
    for (;;) {
      const reply = await this.chat.collectReply(session.id);
      const left = until - Date.now();
      if (reply || left <= 0) return reply;
      // The last look falls on the deadline, so a hook asking N seconds waits N.
      await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_MS, left)));
    }
  }
}
