import type { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopTicketFactory } from '../../../application/desktop-ticket.factory';
import type { HostAccessPort } from '../../../application/host-access.port';
import { HostErrors } from '../../../domain/hosts.errors';
import { IssueDesktopTicketCommand } from '../issue-desktop-ticket.command';
import { IssueDesktopTicketCommandHandler } from '../issue-desktop-ticket.command-handler';

/**
 * A desktop ticket buys somebody's screen, mouse and keyboard, so it is minted
 * only for a caller who may use the host, in the workspace the relay will
 * judge them in again; the relay's re-checks are `relay.gateways.spec.ts`.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

describe('IssueDesktopTicketCommandHandler', () => {
  let hosts: Pick<HostAccessPort, 'assertUsable'>;
  let cache: { setIfAbsent: ReturnType<typeof vi.fn> };
  let handler: IssueDesktopTicketCommandHandler;

  beforeEach(() => {
    hosts = { assertUsable: vi.fn().mockResolvedValue({ probedTools: null }) };
    cache = { setIfAbsent: vi.fn().mockResolvedValue(true) };
    handler = new IssueDesktopTicketCommandHandler(
      hosts as HostAccessPort,
      new DesktopTicketFactory(cache as unknown as CacheService),
    );
  });

  it('mints a single-use ticket naming the host, the person and their workspace', async () => {
    const issued = await handler.execute(
      new IssueDesktopTicketCommand({ scope: SCOPE, hostId: 'host-1' }),
    );

    expect(hosts.assertUsable).toHaveBeenCalledWith(SCOPE, 'host-1');
    expect(issued.url).toBe('/api/v1/relay/desktop');
    expect(cache.setIfAbsent).toHaveBeenCalledWith(
      `desktop:${issued.ticket}`,
      { hostId: 'host-1', organizationId: 'org-acme', userId: 'user-1' },
      60,
    );
  });

  it('refuses a host the caller may not use with HOSTS_001 and mints nothing', async () => {
    vi.mocked(hosts.assertUsable).mockRejectedValue(new AppError(HostErrors.NOT_FOUND));

    await expect(
      handler.execute(new IssueDesktopTicketCommand({ scope: SCOPE, hostId: 'host-2' })),
    ).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });

  it('refuses a caller acting in no workspace, since the relay could judge them in none', async () => {
    await expect(
      handler.execute(
        new IssueDesktopTicketCommand({ scope: { ...SCOPE, organizationId: null }, hostId: 'h' }),
      ),
    ).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(hosts.assertUsable).not.toHaveBeenCalled();
    expect(cache.setIfAbsent).not.toHaveBeenCalled();
  });

  it('answers HOSTS_010 when the ticket store will not take the ticket', async () => {
    cache.setIfAbsent.mockResolvedValue(false);

    await expect(
      handler.execute(new IssueDesktopTicketCommand({ scope: SCOPE, hostId: 'host-1' })),
    ).rejects.toMatchObject({ code: 'HOSTS_010' });
  });
});
