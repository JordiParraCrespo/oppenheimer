import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { BROWSER_REPLY_LEASE_SECONDS } from '@oppenheimer/shared';
import type {
  BrowserCloudReply,
  SessionCloudChatRepositoryPort,
} from '../../database/session-cloud-chat.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { SESSION_CLOUD_CHAT_REPOSITORY } from '../../sessions.di-tokens';
import { ClaimCloudRepliesCommand } from './claim-cloud-replies.command';

/** How often a waiting extension's request looks for a reply. */
const POLL_MS = 1000;

/**
 * Hands the browser extension every reply its person typed that still waits in
 * this workspace's Claude Code cloud sessions, claimed for it, so it posts them
 * on claude.ai as that person: the session runs one at once, mid-turn too,
 * instead of waiting for its Stop hook. With none waiting it looks again each
 * second for up to the wait asked. The claim is the repository's, the same as
 * the hook's and a host's, so a reply reaches the agent one way only; it
 * lapses unless the extension confirms it, so a post that never happened
 * leaves the reply waiting again rather than lost.
 */
@CommandHandler(ClaimCloudRepliesCommand)
export class ClaimCloudRepliesCommandHandler
  implements ICommandHandler<ClaimCloudRepliesCommand, BrowserCloudReply[]>
{
  constructor(
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
  ) {}

  async execute(command: ClaimCloudRepliesCommand): Promise<BrowserCloudReply[]> {
    const organizationId = command.scope.organizationId;
    if (!organizationId) throw new AppError(SessionErrors.NO_ACTIVE_ORGANIZATION);
    const until = Date.now() + command.waitSeconds * 1000;
    for (;;) {
      const replies = await this.chat.claimRepliesForBrowser(
        organizationId,
        command.userId,
        BROWSER_REPLY_LEASE_SECONDS,
      );
      const left = until - Date.now();
      if (replies.length > 0 || left <= 0) return replies;
      await new Promise((resolve) => setTimeout(resolve, Math.min(POLL_MS, left)));
    }
  }
}
