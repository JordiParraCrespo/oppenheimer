import { Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import type { LinkRegistryPort } from '../../links/application/link-registry.port';
import type { LinkRepliesPort, LinkReply } from '../../links/application/link-replies.port';
import { RelaySessionChangesAdapter } from '../../links/infrastructure/relay-session-changes.adapter';
import type {
  SessionChangesOutcome,
  SessionChangesPort,
} from '../application/session-changes.port';
import { SessionLoaderResolver } from '../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { WorkSessionEntity } from '../domain/work-session.entity';
import { FindSessionChangesQuery } from '../queries/find-session-changes/find-session-changes.query';
import { FindSessionChangesQueryHandler } from '../queries/find-session-changes/find-session-changes.query-handler';

/**
 * The Review's read of a session's changes: asked of the session's own host
 * with the scope the reader picked, the host's answer made explicit (every
 * field the wire leaves out filled in, totals summed), a host that cannot
 * answer drawn as a state, and a runner without the capability never sent
 * a frame it would not answer.
 */

const SCOPE = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

describe('reading a session’s changes', () => {
  let outcome: SessionChangesOutcome;
  let read: ReturnType<typeof vi.fn>;
  let work: WorkSessionEntity;
  let loader: SessionLoaderResolver;
  let hosts: HostAccessPort;

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
    read = vi.fn(async () => outcome);
    loader = new SessionLoaderResolver(sessions);
    hosts = { assertUsable: vi.fn().mockResolvedValue({}) } as unknown as HostAccessPort;
  });

  const execute = (compare: 'base' | 'uncommitted' = 'base') =>
    new FindSessionChangesQueryHandler(loader, hosts, {
      read,
    } as unknown as SessionChangesPort).execute(
      new FindSessionChangesQuery({ scope: SCOPE, sessionId: work.id, compare }),
    );

  it('asks the session’s host with the scope and fills in what the wire leaves out', async () => {
    outcome = {
      kind: 'listed',
      checkouts: [
        {
          repo: 'acme/web',
          baseBranch: 'main',
          files: [
            {
              path: 'a.ts',
              status: 'modified',
              additions: 3,
              deletions: 1,
              patch: 'diff --git a/a.ts b/a.ts\n',
            },
            { path: 'logo.png', status: 'added', additions: 0, deletions: 0, binary: true },
            {
              path: 'big.ts',
              status: 'modified',
              additions: 900,
              deletions: 2,
              patchOmitted: true,
            },
          ],
          omittedFiles: 4,
        },
      ],
    };
    const answer = await execute('uncommitted');

    expect(read).toHaveBeenCalledWith('host-1', work.id, 'uncommitted');
    expect(answer.state).toBe('listed');
    expect(answer.scope).toBe('uncommitted');
    const [checkout] = answer.checkouts;
    expect(checkout).toMatchObject({
      repository: 'acme/web',
      checkoutId: null,
      baseBranch: 'main',
      base: null,
      approximate: false,
      omittedFiles: 4,
      additions: 903,
      deletions: 3,
    });
    expect(checkout.files[1]).toEqual({
      path: 'logo.png',
      oldPath: null,
      status: 'added',
      additions: 0,
      deletions: 0,
      binary: true,
      patch: null,
      patchOmitted: false,
    });
    expect(checkout.files[2].patchOmitted).toBe(true);
  });

  it('draws a host with no link, or a runner that cannot read changes, as a state', async () => {
    outcome = { kind: 'host_offline' };
    expect(await execute()).toEqual({ state: 'host_offline', scope: 'base', checkouts: [] });
    outcome = { kind: 'failed', code: 'SESS_001' };
    expect(await execute()).toEqual({ state: 'not_supported', scope: 'base', checkouts: [] });
  });

  it('reports a host that did not answer in time as SESSIONS_031', async () => {
    outcome = { kind: 'timed_out' };
    await expect(execute()).rejects.toMatchObject({ code: 'SESSIONS_031' });
  });
});

describe('the relay’s read of a session’s changes', () => {
  const sessionId = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';

  function relay(capabilities: string[], answer: (commandId: string) => LinkReply | null) {
    const sent: unknown[] = [];
    let commandId = '';
    const links = {
      find: () => ({
        capabilities,
        send: (message: { commandId: string }) => {
          sent.push(message);
          commandId = message.commandId;
          return true;
        },
      }),
    } as unknown as LinkRegistryPort;
    const replies = {
      expect: () => ({
        reply: Promise.resolve().then(() => answer(commandId)),
        cancel: () => {},
      }),
    } as unknown as LinkRepliesPort;
    return { adapter: new RelaySessionChangesAdapter(links, replies), sent };
  }

  it('never sends the read to a runner whose hello did not name it', async () => {
    const { adapter, sent } = relay(['session.windows.list'], () => null);
    expect(await adapter.read('host-1', sessionId, 'base')).toEqual({ kind: 'not_supported' });
    expect(sent).toEqual([]);
  });

  it('takes only the answer for this session', async () => {
    const { adapter, sent } = relay(['session.changes.read'], (commandId) => ({
      type: 'session.changes',
      commandId,
      sessionId,
      scope: 'base',
      checkouts: [],
    }));
    expect(await adapter.read('host-1', sessionId, 'base')).toEqual({
      kind: 'listed',
      checkouts: [],
    });
    expect(sent).toMatchObject([{ type: 'session.changes.read', sessionId, scope: 'base' }]);

    const other = relay(['session.changes.read'], (commandId) => ({
      type: 'session.changes',
      commandId,
      sessionId: '7d3e5a10-0000-4000-8000-000000000000',
      scope: 'base',
      checkouts: [],
    }));
    expect(await other.adapter.read('host-1', sessionId, 'base')).toEqual({
      kind: 'failed',
      code: 'UNEXPECTED_REPLY',
    });
  });
});
