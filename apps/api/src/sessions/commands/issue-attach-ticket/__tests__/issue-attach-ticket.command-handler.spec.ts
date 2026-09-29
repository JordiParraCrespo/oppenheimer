import type { ConfigService } from '@nestjs/config';
import type { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import { HostErrors } from '../../../../hosts/domain/hosts.errors';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { IssueAttachTicketCommand } from '../issue-attach-ticket.command';
import { IssueAttachTicketCommandHandler } from '../issue-attach-ticket.command-handler';

/**
 * A ticket buys a PTY on somebody's machine, so owning the session is not
 * enough: the caller must still be able to use its host. A grant revoked, or a
 * host unpaired, since the session was created is a 404 and no ticket.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function session() {
  return WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
  });
}

describe('IssueAttachTicketCommandHandler', () => {
  let hosts: { assertUsable: ReturnType<typeof vi.fn> };
  let cache: { setIfAbsent: ReturnType<typeof vi.fn> };
  let handler: IssueAttachTicketCommandHandler;
  let work: WorkSessionEntity;

  beforeEach(() => {
    work = session();
    const sessions = {
      findOneById: vi.fn().mockResolvedValue(Some(work)),
    } as unknown as WorkSessionRepositoryPort;
    hosts = { assertUsable: vi.fn().mockResolvedValue({ probedTools: null }) };
    cache = { setIfAbsent: vi.fn().mockResolvedValue(true) };
    // `sessions.attachTicketTtlSeconds` at its default.
    const config = {
      getOrThrow: (key: string) => {
        if (key === 'sessions.attachTicketTtlSeconds') return 60;
        throw new Error(`Missing config ${key}`);
      },
    } as unknown as ConfigService;
    handler = new IssueAttachTicketCommandHandler(
      new SessionLoaderResolver(sessions),
      hosts as unknown as HostAccessPort,
      cache as unknown as CacheService,
      config,
    );
  });

  const command = () =>
    new IssueAttachTicketCommand({
      scope: SCOPE,
      sessionId: work.id,
      userId: 'user-1',
      window: 0,
    });

  it('mints a ticket for a session on a host the caller can still use', async () => {
    const issued = await handler.execute(command());

    expect(hosts.assertUsable).toHaveBeenCalledWith(SCOPE, 'host-1');
    expect(cache.setIfAbsent).toHaveBeenCalledOnce();
    expect(issued.ticket).toEqual(expect.any(String));
  });

  it('refuses with HOSTS_001, and mints nothing, once the host is out of reach', async () => {
    hosts.assertUsable.mockRejectedValue(new AppError(HostErrors.NOT_FOUND));

    // Regression: the ticket used to be minted, and redeemed, after the grant
    // that let the caller use the host was revoked.
    await expect(handler.execute(command())).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });
});
