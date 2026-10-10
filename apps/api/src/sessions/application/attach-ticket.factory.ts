import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { SessionErrors } from '../domain/sessions.errors';
import { ATTACH_TICKET_PREFIX, type AttachTicket } from './session-lookup.port';

/**
 * A ticket is a **Redis key, not a table**: a row whose whole life is shorter than a
 * request timeout earns no table.
 *
 * Sixty seconds, not thirty. Single use is the real control, bounding the risk to one
 * attach, so the lifetime buys reliability: mint, DNS, TLS and upgrade on a cold radio
 * can take five to ten seconds, and too tight means "the terminal did not open" on
 * precisely the device this product exists for.
 */
export const ATTACH_TICKET_TTL_SECONDS = 60;
/** The path the console opens the socket on, on this API's own origin. */
const ATTACH_URL = '/api/v1/relay/attach';

export interface IssuedAttachTicket {
  ticket: string;
  url: string;
  expiresAt: Date;
  window: number;
}

/**
 * Mints a single-use ticket for a claim its caller has already judged: a
 * member's terminal or a share link's.
 *
 * The ticket **travels in `Sec-WebSocket-Protocol`**, never the query string: a
 * browser can set a subprotocol but not WebSocket headers, and proxies, CDNs and load
 * balancers log request lines by default, while this ticket buys an interactive
 * shell. It is **claimed atomically**: `setIfAbsent` is a `SET … NX`, so two mints
 * never collide, and the consumer's read-and-delete makes it single use.
 */
@Injectable()
export class AttachTicketFactory {
  constructor(private readonly cache: CacheService) {}

  async issue(claim: AttachTicket): Promise<IssuedAttachTicket> {
    // 32 bytes of `node:crypto`, base64url: unguessable, and URL-safe because it
    // travels as a subprotocol token.
    const ticket = randomBytes(32).toString('base64url');
    const claimed = await this.cache.setIfAbsent<AttachTicket>(
      `${ATTACH_TICKET_PREFIX}${ticket}`,
      claim,
      ATTACH_TICKET_TTL_SECONDS,
    );
    if (!claimed) throw new AppError(SessionErrors.ATTACH_TICKET_UNAVAILABLE);

    // No hint here, deliberately: this never asks a dispatcher, so any hint it
    // invented would be a guess about a link it cannot see. Whether the host is
    // reachable is the relay's answer, on the socket that tries.
    return {
      ticket,
      url: ATTACH_URL,
      expiresAt: new Date(Date.now() + ATTACH_TICKET_TTL_SECONDS * 1000),
      window: claim.window,
    };
  }
}
