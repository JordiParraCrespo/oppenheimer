import { Injectable } from '@nestjs/common';
import { CacheService, issueSingleUseTicket } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { HostErrors } from '../domain/hosts.errors';
import {
  DESKTOP_SOCKET_PATH,
  DESKTOP_TICKET_PREFIX,
  type DesktopTicket,
} from './desktop-ticket.port';

/** Single use, and long enough for a cold radio's DNS, TLS and upgrade (`AttachTicketFactory`). */
export const DESKTOP_TICKET_TTL_SECONDS = 60;

export interface IssuedDesktopTicket {
  ticket: string;
  url: string;
  expiresAt: Date;
}

/**
 * Mints a single-use ticket for a desktop its caller has already judged. It
 * is a terminal's attach ticket in every way that matters, because it buys
 * as much (`issueSingleUseTicket`): read-and-deleted by the relay, presented
 * as the WebSocket subprotocol and never in a URL.
 */
@Injectable()
export class DesktopTicketFactory {
  constructor(private readonly cache: CacheService) {}

  async issue(claim: DesktopTicket): Promise<IssuedDesktopTicket> {
    const issued = await issueSingleUseTicket(
      this.cache,
      DESKTOP_TICKET_PREFIX,
      claim,
      DESKTOP_TICKET_TTL_SECONDS,
    );
    if (!issued) throw new AppError(HostErrors.DESKTOP_TICKET_UNAVAILABLE);
    return { ...issued, url: DESKTOP_SOCKET_PATH };
  }
}
