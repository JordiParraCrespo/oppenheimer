import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import { SessionLoaderResolver } from '../../../application/session-loader.resolver';
import type {
  SessionPortsOutcome,
  SessionPortsPort,
} from '../../../application/session-ports.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { WorkSessionEntity } from '../../../domain/work-session.entity';
import { FindSessionPortsQuery } from '../find-session-ports.query';
import { FindSessionPortsQueryHandler } from '../find-session-ports.query-handler';

/**
 * The Browser tab's read: a host with no link, or a runner that cannot list
 * ports, is a state the tab draws, not a failure; only a runner that does not
 * answer in time is one (`SESSIONS_031`). The session's own host is the one
 * asked, about this session.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

describe('FindSessionPortsQueryHandler', () => {
  let outcome: SessionPortsOutcome;
  let ports: { list: ReturnType<typeof vi.fn> };
  let handler: FindSessionPortsQueryHandler;
  let work: WorkSessionEntity;

  beforeEach(() => {
    work = WorkSessionEntity.request({
      organizationId: 'org-acme',
      projectId: 'project-1',
      createdByUserId: 'user-1',
      hostId: 'host-1',
      slug: 'bold-otter-3f9a7k',
      agent: 'claude-code',
    });
    const sessions = {
      findOneById: vi.fn().mockResolvedValue(Some(work)),
    } as unknown as WorkSessionRepositoryPort;
    ports = { list: vi.fn(async () => outcome) };
    handler = new FindSessionPortsQueryHandler(
      new SessionLoaderResolver(sessions),
      { assertUsable: vi.fn().mockResolvedValue({}) } as unknown as HostAccessPort,
      ports as unknown as SessionPortsPort,
    );
  });

  const read = () =>
    handler.execute(new FindSessionPortsQuery({ scope: SCOPE, sessionId: work.id }));

  it("lists the session's ports, asking its own host about it", async () => {
    outcome = { kind: 'listed', ports: [{ port: 5173, process: 'node' }] };

    await expect(read()).resolves.toEqual({
      state: 'listed',
      ports: [{ port: 5173, process: 'node' }],
    });
    expect(ports.list).toHaveBeenCalledWith('host-1', work.id);
  });

  it('answers an offline host, or a runner that cannot list, as a state with no ports', async () => {
    outcome = { kind: 'host_offline' };
    await expect(read()).resolves.toEqual({ state: 'host_offline', ports: [] });
    outcome = { kind: 'failed', code: 'PORT_003' };
    await expect(read()).resolves.toEqual({ state: 'not_supported', ports: [] });
  });

  it('refuses with SESSIONS_031 when the host does not answer in time', async () => {
    outcome = { kind: 'timed_out' };
    await expect(read()).rejects.toMatchObject({ code: 'SESSIONS_031' });
  });
});
