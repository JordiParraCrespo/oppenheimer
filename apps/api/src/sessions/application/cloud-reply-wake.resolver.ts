import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SessionCloudChatRepositoryPort } from '../database/session-cloud-chat.repository.port';
import { SESSION_CLOUD_CHAT_REPOSITORY, SESSION_CLOUD_PROMPT } from '../sessions.di-tokens';
import type { SessionCloudPromptPort } from './session-cloud-prompt.port';

/** The session a reply is for: a Claude Code cloud session with a chat. */
export interface WakeableSession {
  id: string;
  organizationId: string;
  hostId: string | null;
  cloudSessionId: string | null;
}

/** What became of a reply the waker was handed. */
export type CloudReplyWake =
  /** The session was not idle: a Stop hook will take the reply. */
  | 'waiting'
  /** The host sent it: the session wakes with it. */
  | 'sent'
  /** The host did not answer in time: it may have reached the session, so it is not sent again. */
  | 'unknown'
  /** The host could not send it: it waits for the next Stop hook, and the next reply tries again. */
  | 'returned';

/**
 * Wakes an idle Claude Code cloud session with a reply typed in its chat
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session"). The
 * Stop hook hands a reply to the agent while it waits; once its wait has
 * ended empty (`markIdle`) only a new message wakes the session, so the host
 * that started it sends one with the account's own CLI.
 *
 * The order is what keeps a reply from reaching the agent twice or not at
 * all: the session's idle mark is claimed first (two replies at once wake it
 * once; the second waits for the woken turn's hook), then the reply itself
 * (a hook that took it first wins), then the host is asked. A refusal that
 * certainly sent nothing puts both back; no answer in time keeps the claim,
 * since the session may have the message, as a Cursor follow-up does.
 */
@Injectable()
export class CloudReplyWakeResolver {
  private readonly logger = new Logger(CloudReplyWakeResolver.name);

  constructor(
    @Inject(SESSION_CLOUD_CHAT_REPOSITORY)
    private readonly chat: SessionCloudChatRepositoryPort,
    @Inject(SESSION_CLOUD_PROMPT)
    private readonly prompt: SessionCloudPromptPort,
  ) {}

  async wake(
    session: WakeableSession,
    reply: { id: string; text: string },
  ): Promise<CloudReplyWake> {
    const { hostId, cloudSessionId } = session;
    if (!hostId || !cloudSessionId) return 'waiting';
    if (!(await this.chat.claimIdle(session.organizationId, session.id))) return 'waiting';
    if (!(await this.chat.claimReply(session.id, reply.id))) {
      // A hook took it between the two claims, so the session is not idle.
      return 'waiting';
    }

    const outcome = await this.prompt.send(hostId, session.id, cloudSessionId, reply.text);
    if (outcome.kind === 'sent') return 'sent';
    const log = {
      message: 'a cloud session reply could not be sent from its host',
      sessionId: session.id,
      hostId,
      outcome: outcome.kind,
      code: outcome.kind === 'failed' ? outcome.code : undefined,
    };
    this.logger.warn(log);
    if (outcome.kind === 'timed_out') return 'unknown';
    await this.chat.releaseReply(session.id, reply.id);
    await this.chat.markIdle(session.organizationId, session.id);
    return 'returned';
  }
}
