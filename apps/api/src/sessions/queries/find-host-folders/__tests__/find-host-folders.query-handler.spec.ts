import { AppError } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import type { HostFoldersOutcome, HostFoldersPort } from '../../../application/host-folders.port';
import type { WorkSessionRepositoryPort } from '../../../database/work-session.repository.port';
import { WorkSessionMapper } from '../../../work-session.mapper';
import { FindHostFoldersQuery } from '../find-host-folders.query';
import {
  FindHostFoldersQueryHandler,
  RECENT_FOLDERS_LIMIT,
} from '../find-host-folders.query-handler';

/**
 * The folder picker's read: the host check a create makes, then the runner's
 * listing or the problem for each way it can fail, and the caller's recent
 * folders beside it. The wire half (the request and its correlation) is
 * `relay-host-folders.adapter.spec.ts`; the recent folders' SQL is the
 * sessions integration suite.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

const LISTING = {
  path: '/home/jordi/code',
  parent: '/home/jordi',
  home: '/home/jordi',
  entries: [{ name: 'xrp-mobile', branch: 'main' }, { name: 'notes' }],
};

const RECENT = [{ path: '/home/jordi/notes', lastUsedAt: new Date('2026-10-14T10:00:00Z') }];

function harness(outcome: HostFoldersOutcome) {
  const hosts: HostAccessPort = {
    assertUsable: vi.fn().mockResolvedValue({ ownerUserId: 'user-1', probedTools: null }),
  };
  const folders: HostFoldersPort = { list: vi.fn().mockResolvedValue(outcome) };
  const sessions: Pick<WorkSessionRepositoryPort, 'findRecentFolders'> = {
    findRecentFolders: vi.fn().mockResolvedValue(RECENT),
  };
  const handler = new FindHostFoldersQueryHandler(
    hosts,
    folders,
    sessions as WorkSessionRepositoryPort,
  );
  return { hosts, folders, sessions, handler };
}

const query = (path?: string) =>
  new FindHostFoldersQuery({ scope: SCOPE, userId: 'user-1', hostId: 'host-1', path });

describe('FindHostFoldersQueryHandler', () => {
  it('answers the runner’s listing and the caller’s own recent folders on that host', async () => {
    const h = harness({ kind: 'listed', listing: LISTING });

    await expect(h.handler.execute(query('/home/jordi/code'))).resolves.toEqual({
      listing: LISTING,
      recent: RECENT,
    });
    expect(h.folders.list).toHaveBeenCalledWith('host-1', '/home/jordi/code');
    expect(h.sessions.findRecentFolders).toHaveBeenCalledWith(
      SCOPE,
      'host-1',
      'user-1',
      RECENT_FOLDERS_LIMIT,
    );
  });

  it('refuses a host the caller cannot use, and asks the host nothing', async () => {
    const h = harness({ kind: 'listed', listing: LISTING });
    vi.mocked(h.hosts.assertUsable).mockRejectedValue(
      new AppError({ code: 'HOSTS_001', message: 'Host not found', httpStatus: 404 }),
    );

    await expect(h.handler.execute(query())).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(h.folders.list).not.toHaveBeenCalled();
    expect(h.sessions.findRecentFolders).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'host_offline' } as const, 'SESSIONS_027', 503],
    [{ kind: 'not_supported' } as const, 'SESSIONS_026', 409],
    [{ kind: 'timed_out' } as const, 'SESSIONS_031', 504],
    [{ kind: 'failed', code: 'FS_001' } as const, 'SESSIONS_028', 404],
    [{ kind: 'failed', code: 'FS_002' } as const, 'SESSIONS_029', 422],
    [{ kind: 'failed', code: 'FS_003' } as const, 'SESSIONS_030', 403],
  ])('answers %o with %s (%i)', async (outcome, code, status) => {
    const h = harness(outcome);
    const refused = await h.handler.execute(query('/home/jordi/x')).catch((error) => error);
    expect(refused).toBeInstanceOf(AppError);
    expect(refused).toMatchObject({ code });
    expect((refused as AppError).getStatus()).toBe(status);
  });

  it('reads a refusal code no runner names yet as not readable, keeping the code', async () => {
    const h = harness({ kind: 'failed', code: 'FS_099', detail: 'stale handle' });

    await expect(h.handler.execute(query('/mnt/nfs'))).rejects.toMatchObject({
      code: 'SESSIONS_030',
      detail: 'stale handle',
      extensions: { upstreamCode: 'FS_099' },
    });
  });
});

describe('WorkSessionMapper.toFoldersResponse', () => {
  it('joins each entry onto the listed folder and spells out what the runner left unsaid', () => {
    const dto = new WorkSessionMapper().toFoldersResponse(LISTING, RECENT);

    expect(dto).toEqual({
      path: '/home/jordi/code',
      parent: '/home/jordi',
      home: '/home/jordi',
      branch: null,
      entries: [
        { name: 'xrp-mobile', path: '/home/jordi/code/xrp-mobile', branch: 'main' },
        { name: 'notes', path: '/home/jordi/code/notes', branch: null },
      ],
      truncated: false,
      recent: RECENT,
    });
  });

  it('joins at the root without doubling the separator', () => {
    const dto = new WorkSessionMapper().toFoldersResponse(
      { path: '/', parent: null, home: '/root', entries: [{ name: 'srv' }], truncated: true },
      [],
    );

    expect(dto.entries[0].path).toBe('/srv');
    expect(dto.truncated).toBe(true);
  });
});
