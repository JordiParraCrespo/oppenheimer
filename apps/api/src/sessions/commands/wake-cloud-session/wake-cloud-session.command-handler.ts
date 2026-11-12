import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOUD_REPLY_PREAMBLE } from '@oppenheimer/shared';
import type { HostClaudeAccountsPort } from '../../../hosts/application/host-claude-accounts.port';
import { HOST_CLAUDE_ACCOUNTS } from '../../../hosts/hosts.di-tokens';
import type { CloudSessionReplyPort } from '../../application/cloud-session-reply.port';
import type { SessionCloudChatRepositoryPort } from '../../database/session-cloud-chat.repository.port';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { hasCloudChat } from '../../domain/cloud-chat.policy';
import {
  CLOUD_SESSION_REPLY,
  SESSION_CLOUD_CHAT_REPOSITORY,
  WORK_SESSION_REPOSITORY,
} from '../../sessions.di-tokens';
import { WakeCloudSessionCommand } from './wake-cloud-session.command';

/** What one wake did, for its job's result and the log. */
export type WakeCloudSessionResult =
  | 'sent'
  | 'unconfirmed'
  | 'taken'
  | 'no_session'
  | 'no_account'
  | 'no_host'
  | 'refused';

/**
 * Sends a reply the Stop hook did not take from a host, so it wakes an idle
 * Claude Code cloud session (`product/next-steps/cloud-agents.md`, "The chat
 * of a cloud session", decision 2). Runs once per reply, when its wake comes
 * due.
 *
 * - **Which host.** Only one signed in to the claude.ai account the session
 *   runs on: the account of the host that started it. That host first, then
 *   the launcher's other hosts on the same account (`HostClaudeAccountsPort`);
 *   the first online one whose runner takes `cloud.reply` is asked.
 * - **Never twice.** The reply is claimed (`claimReplyForHost`) before it is
 *   sent, by the same `collectedAt IS NULL` claim the hook's take makes, so
 *   whichever comes first delivers it and the other finds nothing.
 * - **Handed back** to the hook when it certainly did not go: no such host
 *   online, or Claude Code refused it. A send that may have gone (no answer
 *   in time, `SESS_021`) keeps its claim: a reply the agent may have twice is
 *   worse than one the person sees and types again.
 *
 * The text is the hook's own (`CLOUD_REPLY_PREAMBLE`, then the reply), so the
 * agent reads it the same either way and the console finds it in the
 * transcript as the person's message.
 */
@CommandHandler(WakeCloudSessionCommand)
export class WakeCloudSessionCommandHandler
  implements ICommandHandler<WakeCloudSessionCommand, WakeCloudSessionResult>
{
  private readonly logger = new Logger(WakeCloudSessionCommandHandler.name);

  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
    @Inject(HOST_CLAUDE_ACCOUNTS)
    private readonly accounts: HostClaudeAccountsPort,
    @Inject(CLOUD_SESSION_REPLY)
    private readonly replies: CloudSessionReplyPort,
  ) {}

  async execute(command: WakeCloudSessionCommand): Promise<WakeCloudSessionResult> {
    const { sessionId, replyId } = command.wake;
    const found = await this.sessions.findOneByIdForMachine(sessionId);
    if (found.isNone()) return 'no_session';
    const session = found.unwrap();
    const cloudSessionId = session.cloudSessionId;
    if (!hasCloudChat(session) || !cloudSessionId || session.isResolved) return 'no_session';
    // A session no host started has no account to send from.
    const hostIds = session.hostId
      ? await this.accounts.signedInLike(session.hostId, session.createdByUserId)
      : [];
    if (hostIds.length === 0) {
      this.logger.log({ message: 'A cloud reply waits for its hook: no account', ...command.wake });
      return 'no_account';
    }

    const reply = await this.chat.claimReplyForHost(sessionId, replyId);
    if (!reply) return 'taken';
    const outcome = await this.replies.send(
      hostIds,
      cloudSessionId,
      `${CLOUD_REPLY_PREAMBLE}\n\n${reply.text}`,
    );
    switch (outcome.kind) {
      case 'sent':
        return 'sent';
      case 'unconfirmed':
        this.logger.warn({
          message: 'A cloud reply was sent from a host that did not confirm it',
          ...command.wake,
          hostId: outcome.hostId,
          code: outcome.code,
        });
        return 'unconfirmed';
      case 'no_host':
        await this.chat.releaseHostClaim(sessionId, replyId);
        this.logger.log({ message: 'A cloud reply waits for its hook: no host', ...command.wake });
        return 'no_host';
      case 'refused':
        await this.chat.releaseHostClaim(sessionId, replyId);
        this.logger.warn({
          message: 'A host could not send a cloud reply; it waits for its hook',
          ...command.wake,
          hostId: outcome.hostId,
          code: outcome.code,
          detail: outcome.detail,
        });
        return 'refused';
    }
  }
}
