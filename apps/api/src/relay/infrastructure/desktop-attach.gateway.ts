import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SCOPE_RESOLVER, type ScopeResolverPort } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { ATTACH_CLOSE_CODES, type AttachServerMessage } from '@oppenheimer/shared/protocol';
import type { WebSocket } from 'ws';
import type { CredentialOwnerPort } from '../../auth/application/credential-owner.port';
import { CREDENTIAL_OWNER } from '../../auth/auth.di-tokens';
import type { FlagEvaluatorPort } from '../../feature-flags/application/flag-evaluator.port';
import { FLAG_EVALUATOR } from '../../feature-flags/feature-flags.di-tokens';
import {
  DESKTOP_SOCKET_PATH,
  DESKTOP_TICKET_PREFIX,
  type DesktopTicket,
} from '../../hosts/application/desktop-ticket.port';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../hosts/hosts.di-tokens';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../links/links.di-tokens';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';
import { ATTACH_PING_INTERVAL_MS, REAUTHORIZE_INTERVAL_MS } from './browser-attach.gateway';
import { DesktopAttachment, type DesktopVerdict } from './desktop-attachment.util';
import { type EarlyFrame, endSocket, TicketSocket, tellSocket } from './ticket-socket.util';

/** The path the console opens, the one `POST /hosts/{id}/desktop-ticket` names. */
export const DESKTOP_ATTACH_PATH = DESKTOP_SOCKET_PATH;

/** The largest frame a browser sends: one RFB message, a clipboard's text at most. */
const MAX_INPUT_BYTES = 1024 * 1024 + 64;

type AttachClosedReason = Extract<AttachServerMessage, { type: 'closed' }>['reason'];

/**
 * The desktop socket: one per browser watching a host's desktop, on the same
 * ticket lifecycle as the attach socket (`TicketSocket`). A ticket names a
 * host, not a session, so the Desktop tab beside a session and a host's
 * Desktop in Settings open the same socket.
 *
 * What it re-checks at redemption and every `REAUTHORIZE_INTERVAL_MS`: the
 * person is still a member of the workspace the ticket was minted in, their
 * account may still act, and they may still use the host (own it, or hold a
 * grant on it, and it is still paired). The host's owner sharing the desktop
 * at all is the runner's answer (`DESKTOP_001`), relayed as `refused`.
 */
@Injectable()
export class DesktopAttachGateway {
  /** `REAUTHORIZE_INTERVAL_MS`; a field only so a test can shorten it. */
  reauthorizeIntervalMs = REAUTHORIZE_INTERVAL_MS;
  /** `ATTACH_PING_INTERVAL_MS`; a field only so a test can shorten it. */
  pingIntervalMs = ATTACH_PING_INTERVAL_MS;
  private readonly logger = new Logger(DesktopAttachGateway.name);
  private readonly socket = new TicketSocket({
    name: 'desktop',
    maxPayload: MAX_INPUT_BYTES,
    pingIntervalMs: () => this.pingIntervalMs,
    frontendUrl: () => this.configService.get<string>('app.frontendUrl'),
    logger: this.logger,
    redeem: (ws, ticket, early) => this.judge(ws, ticket, early),
  });

  constructor(
    private readonly cache: CacheService,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    private readonly configService: ConfigService,
    @Inject(SCOPE_RESOLVER)
    private readonly scopes: ScopeResolverPort,
    @Inject(HOST_ACCESS)
    private readonly hostAccess: HostAccessPort,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
    @Inject(FLAG_EVALUATOR)
    private readonly flags: FlagEvaluatorPort,
  ) {}

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    return this.socket.handleUpgrade(request, socket, head);
  }

  private async judge(ws: WebSocket, ticket: string, early: EarlyFrame[]): Promise<void> {
    const claim = await this.cache.take<DesktopTicket>(`${DESKTOP_TICKET_PREFIX}${ticket}`);
    if (!claim) {
      endSocket(ws, 'unauthorized', ATTACH_CLOSE_CODES.UNAUTHORIZED);
      return;
    }
    const verdict = await this.authorize(claim);
    if (!verdict.allowed) {
      endSocket(ws, verdict.reason, verdict.code);
      return;
    }
    const link = this.links.find(claim.hostId);
    if (!link) {
      tellSocket(ws, { type: 'hint', kind: 'host_offline' });
      ws.close(ATTACH_CLOSE_CODES.HOST_OFFLINE, 'host offline');
      return;
    }
    if (ws.readyState !== ws.OPEN) return;
    // The flag is the deployment's off switch, the capability a runner too old
    // to know the messages: both answer as "this host shares no desktop".
    const enabled = this.flags.isEnabled('host_desktop', {
      userId: claim.userId,
      organizationId: claim.organizationId,
    });
    if (!enabled || !link.capabilities.includes('desktop.stream')) {
      tellSocket(ws, {
        type: 'refused',
        code: 'DESKTOP_001',
        detail: enabled ? "This host's runner cannot share its desktop." : 'Desktop is off.',
      });
      ws.close(ATTACH_CLOSE_CODES.REFUSED, 'no desktop');
      return;
    }
    new DesktopAttachment(ws, link, {
      authorize: () => this.authorize(claim),
      everyMs: this.reauthorizeIntervalMs,
      logger: this.logger,
    }).start([...early]);
  }

  /**
   * Whether a desktop ticket still authorises its desktop. A lookup that
   * throws is thrown, never read as a refusal: at redemption that is a 1011
   * the console retries, and on the timer it keeps the socket.
   */
  async authorize(claim: DesktopTicket): Promise<DesktopVerdict> {
    if (!(await this.workspaces.isMember(claim.organizationId, claim.userId))) {
      return refuse('forbidden', ATTACH_CLOSE_CODES.FORBIDDEN);
    }
    if (!(await this.owners.findActiveOwner(claim.userId))) {
      return refuse('forbidden', ATTACH_CLOSE_CODES.FORBIDDEN);
    }
    // The own-or-granted predicate a session on the host asks, platform admin
    // or not: nobody watches a machine they could not start work on.
    const scope = await this.scopes.resolve({
      userId: claim.userId,
      organizationId: claim.organizationId,
      isPlatformAdmin: false,
      hasFullAccess: false,
    });
    try {
      await this.hostAccess.assertUsable(scope, claim.hostId);
    } catch (error) {
      if (error instanceof AppError && error.getStatus() === 404) {
        return refuse('missing', ATTACH_CLOSE_CODES.SESSION_UNAVAILABLE);
      }
      throw error;
    }
    return { allowed: true, hostId: claim.hostId };
  }
}

function refuse(reason: AttachClosedReason, code: number): DesktopVerdict {
  return { allowed: false, reason, code };
}
