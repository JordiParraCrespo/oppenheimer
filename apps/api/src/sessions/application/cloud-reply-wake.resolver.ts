import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOUD_PROMPT_TEXT_MAX_CHARS } from '@oppenheimer/shared/protocol';
import type {
  CloudChatReply,
  SessionCloudChatRepositoryPort,
} from '../database/session-cloud-chat.repository.port';
import { SESSION_CLOUD_CHAT_REPOSITORY, SESSION_CLOUD_PROMPT } from '../sessions.di-tokens';
import type { SessionCloudPromptPort } from './session-cloud-prompt.port';

/**
 * How long a wake may stay unconfirmed before a new reply may wake the
 * session again: longer than the host's answer (75 s) and a woken turn's
 * first hook, so a wake that is only slow is never sent twice.
 */
export const STALE_WAKE_SECONDS = 300;

/** Between two replies sent in one message, as the person typed them. */
const BETWEEN_REPLIES = '\n\n';

/** The session a reply is for: a Claude Code cloud session with a chat. */
export interface WakeableSession {
  id: string;
  organizationId: string;
  hostId: string | null;
  cloudSessionId: string | null;
}

/** What became of the replies waiting when one was typed. */
export type CloudReplyWake =
  /** The session was not idle: a Stop hook will take them. */
  | 'waiting'
  /** The host sent them: the session wakes with them. */
  | 'sent'
  /** The host did not say: they may have reached the session, so they are not sent again. */
  | 'unknown'
  /** The host could not send them: they wait for the next Stop hook, and the next reply tries again. */
  | 'returned';

/**
 * Wakes an idle Claude Code cloud session with what was typed in its chat
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session"). The
 * Stop hook hands a reply to the agent while it waits; once its wait has
 * ended empty (`markIdle`) only a new message wakes the session, so the host
 * that started it sends one with the account's own CLI.
 *
 * The order is what keeps a reply from reaching the agent twice or not at
 * all. The session's idle mark is claimed first: two replies at once wake it
 * once, and the second waits for the woken turn's hook. Then every waiting
 * reply, oldest first, goes in one message, so one put back after a failed
 * wake is not left behind or overtaken (a hook that took one first keeps it).
 * Then the host is asked. A refusal that certainly sent nothing puts the
 * replies and the mark back. No answer keeps the replies, since the session
 * may have them, as a Cursor follow-up does, and puts the mark back so a later
 * reply can still wake it. A wake that never finished (the API stopped
 * mid-way) holds the mark until `STALE_WAKE_SECONDS`, then gives it up.
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

  async wake(session: WakeableSession): Promise<CloudReplyWake> {
    const { hostId, cloudSessionId } = session;
    if (!hostId || !cloudSessionId) return 'waiting';
    const claimed = await this.chat.claimIdle(
      session.organizationId,
      session.id,
      STALE_WAKE_SECONDS,
    );
    if (!claimed) return 'waiting';
    const replies = await this.chat.claimWaiting(session.id);
    // A hook took them between the two claims, so the session is not idle.
    if (replies.length === 0) return 'waiting';

    const { sent, left } = fitted(replies);
    // What does not fit in one message waits for the woken turn's hook.
    await this.chat.releaseReplies(
      session.id,
      left.map((reply) => reply.id),
    );
    const text = sent.map((reply) => reply.text).join(BETWEEN_REPLIES);
    const outcome = await this.prompt.send(hostId, session.id, cloudSessionId, text);
    if (outcome.kind === 'sent') return 'sent';

    this.logger.warn({
      message: 'cloud session replies could not be sent from its host',
      sessionId: session.id,
      hostId,
      replies: sent.length,
      outcome: outcome.kind,
      code: outcome.kind === 'failed' ? outcome.code : undefined,
    });
    if (outcome.kind !== 'timed_out') {
      await this.chat.releaseReplies(
        session.id,
        sent.map((reply) => reply.id),
      );
    }
    await this.chat.markIdle(session.organizationId, session.id);
    return outcome.kind === 'timed_out' ? 'unknown' : 'returned';
  }
}

/** The oldest replies that fit in one message (at least the first: one reply always fits), and the rest. */
function fitted(replies: readonly CloudChatReply[]): {
  sent: CloudChatReply[];
  left: CloudChatReply[];
} {
  let length = 0;
  let count = 0;
  for (const reply of replies) {
    const next = length + (count > 0 ? BETWEEN_REPLIES.length : 0) + reply.text.length;
    if (count > 0 && next > CLOUD_PROMPT_TEXT_MAX_CHARS) break;
    length = next;
    count += 1;
  }
  return { sent: replies.slice(0, count), left: replies.slice(count) };
}
