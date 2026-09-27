import type { AccessScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import { HostUsageRegistry } from '../../../application/host-usage.registry';
import type { HostRepositoryPort } from '../../../database/host.repository.port';
import { FindHostsQuery } from '../find-hosts.query';
import { FindHostsQueryHandler } from '../find-hosts.query-handler';

function scope(): AccessScope {
  return { userId: 'jordi', organizationId: null, teamIds: [], grants: new Map(), bypass: false };
}

function handler() {
  const hosts: Pick<HostRepositoryPort, 'findAllWithPresence'> = {
    findAllWithPresence: vi.fn().mockResolvedValue([]),
  };
  return {
    hosts,
    handler: new FindHostsQueryHandler(hosts as HostRepositoryPort, new HostUsageRegistry()),
  };
}

describe('FindHostsQueryHandler', () => {
  it('leaves removed hosts out unless asked', async () => {
    const { hosts, handler: find } = handler();

    await find.execute(new FindHostsQuery({ scope: scope() }));

    expect(hosts.findAllWithPresence).toHaveBeenCalledWith(expect.anything(), {
      includeUnpaired: false,
    });
  });

  it('includes them for a caller naming the host of a session that outlived it', async () => {
    const { hosts, handler: find } = handler();

    await find.execute(new FindHostsQuery({ scope: scope(), includeUnpaired: true }));

    expect(hosts.findAllWithPresence).toHaveBeenCalledWith(expect.anything(), {
      includeUnpaired: true,
    });
  });
});
