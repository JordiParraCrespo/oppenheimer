import { randomBytes } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { SessionErrors } from '../../domain/sessions.errors';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { IssueAttachTicketCommand } from './issue-attach-ticket.command';

/**
 * A ticket is a **Redis key, not a table**: it cannot outlive the sixty seconds it
 * is valid for, and a row whose whole life is shorter than a request timeout earns
 * no table.
 */
export const ATTACH_TICKET_PREFIX = 'attach:';
/**
 * Sixty seconds, not thirty. Single use is the real control, so the lifetime should
 * buy reliability rather than shave a risk that is already bounded to one attach:
 * mint, DNS, TLS and upgrade on a cold radio can take five to ten seconds, and the
 * failure mode of being too tight is "the terminal did not open" on precisely the
 * device this product exists for.
 */
export const ATTACH_TICKET_TTL_SECONDS = 60;
/** The path the console opens the socket on, on this API's own origin. */
const ATTACH_URL = '/api/v1/relay/attach';

/** What the ticket authorises, read back by whoever consumes it. */
export interface AttachTicket {
  sessionId: string;
  organizationId: string;
  window: number;
  userId: string;
}

export interface IssuedAttachTicket {
  ticket: string;
  url: string;
  expiresAt: Date;
  window: number;
}

/**
 * Mints a single-use ticket for one window of one session.
 *
 * Two properties matter more than the code does. The ticket **travels in
 * `Sec-WebSocket-Protocol`**, never in the query string: a browser cannot set
 * headers on a WebSocket but it can set a subprotocol, and reverse proxies, CDNs
 * and load balancers log request lines by default — a log line is for ever and this
 * ticket buys an interactive shell. And it is **claimed atomically**: `setIfAbsent`
 * is a `SET … NX`, so two mints can never collide on one key, and the consumer's
 * read-and-delete is what makes it single use.
 *
 * Authorization is not frozen at mint. The consumer re-checks that the session is
 * still live and the person is still a member of the owning workspace — without
 * that, stopping the session or revoking the person's access inside the window
 * would still get them a PTY.
 */
@CommandHandler(IssueAttachTicketCommand)
export class IssueAttachTicketCommandHandler
  implements ICommandHandler<IssueAttachTicketCommand, IssuedAttachTicket>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    private readonly cache: CacheService,
  ) {}

  async execute(command: IssueAttachTicketCommand): Promise<IssuedAttachTicket> {
    const found = await this.sessions.findOneById(command.scope, command.sessionId);
    if (found.isNone()) {
      throw new AppError(SessionErrors.NOT_FOUND, {
        detail: `No session with id ${command.sessionId}`,
      });
    }
    const session = found.unwrap();
    if (session.isResolved) {
      throw new AppError(SessionErrors.ALREADY_RESOLVED, {
        detail: `Session ${session.slug} is closed`,
      });
    }

    // 32 bytes of `node:crypto`, base64url: unguessable, and URL-safe because it
    // travels as a subprotocol token.
    const ticket = randomBytes(32).toString('base64url');
    const claimed = await this.cache.setIfAbsent<AttachTicket>(
      `${ATTACH_TICKET_PREFIX}${ticket}`,
      {
        sessionId: session.id,
        organizationId: session.organizationId,
        window: command.window,
        userId: command.userId,
      },
      ATTACH_TICKET_TTL_SECONDS,
    );
    if (!claimed) throw new AppError(SessionErrors.ATTACH_TICKET_UNAVAILABLE);

    // No hint here, deliberately: this handler never asks a dispatcher, so any
    // hint it invented would be a guess about a link it cannot see. Whether the
    // host is reachable is the relay's answer, on the socket that tries.
    return {
      ticket,
      url: ATTACH_URL,
      expiresAt: new Date(Date.now() + ATTACH_TICKET_TTL_SECONDS * 1000),
      window: command.window,
    };
  }
}
